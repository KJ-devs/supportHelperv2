import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { QUEUE_NAMES } from '../queues';
import { VideoAnalysisJobData, VideoAnalysisResult } from '../queues/queue.types';
import { FFmpegService } from '../services/ffmpeg.service';
import { OCRService } from '../services/ocr.service';
import { OpenAIService } from '../services/openai.service';
import { YoloService } from '../services/yolo.service';
import { S3Service } from '../services/s3.service';
import { PrismaService } from '../services/prisma.service';
import { MeilisearchService } from '../services/meilisearch.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

// ═══════════════════════════════════════════════════════════════════════
// VISUAL CUES EXTRACTION
// ═══════════════════════════════════════════════════════════════════════

interface VisualCues {
  errors: string[];
  urls: string[];
  components: string[];
}

function extractVisualCues(ocrText: string): VisualCues {
  const errorRegex = /(?:TypeError|Error|Exception|Warning|WARN|ERROR)[\s:][^\n]{5,80}/g;
  const urlRegex = /(?:https?:\/\/[^\s"'<>]{3,}|\/[a-z][a-z0-9/_-]{2,})/gi;
  const componentRegex = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;

  const errors = [...new Set(ocrText.match(errorRegex) ?? [])].slice(0, 10);
  const urls = [...new Set(ocrText.match(urlRegex) ?? [])].slice(0, 10);
  const components = [...new Set(ocrText.match(componentRegex) ?? [])].slice(0, 15);

  return { errors, urls, components };
}

/**
 * VideoAnalysisWorker
 *
 * BullMQ consumer for video analysis pipeline:
 * 1. Download S3 video
 * 2. FFmpeg keyframe extraction (1 frame/sec)
 * 3. Tesseract OCR parallel (4 workers)
 * 4. YOLO v11 UI detection
 * 5. GPT-4o Vision analysis (batch 10 frames)
 * 6. Generate embeddings (text-embedding-3-small)
 * 7. Update ticket in DB
 * 8. Index Meilisearch
 *
 * Retry Strategy: Exponential backoff (1min, 5min, 15min, 1hr)
 * After 4 failed attempts, job moves to dead-letter queue
 */
@Processor(QUEUE_NAMES.VIDEO_ANALYSIS, {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      const delays: number[] = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
      const index = Math.max(0, Math.min(attemptsMade - 1, delays.length - 1));
      return delays[index]!;
    },
  },
})
export class VideoAnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(VideoAnalysisWorker.name);

  constructor(
    private readonly ffmpegService: FFmpegService,
    private readonly ocrService: OCRService,
    private readonly openaiService: OpenAIService,
    private readonly yoloService: YoloService,
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly meilisearch: MeilisearchService,
    @InjectQueue('dead-letter')
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  /**
   * Main processor method
   */
  async process(job: Job<VideoAnalysisJobData>): Promise<VideoAnalysisResult> {
    const startTime = Date.now();
    const { ticketId, mediaId, tenantId, storageKey, options } = job.data;

    this.logger.log(`Processing video analysis job ${job.id} for media ${mediaId}`);

    let tempVideoPath: string | null = null;
    let tempOutputDir: string | null = null;

    try {
      // Update media status to processing
      await this.updateMediaStatus(mediaId, 'processing');
      await job.updateProgress(5);

      // Step 1: Download video from S3
      this.logger.log('Step 1: Downloading video from S3');
      tempVideoPath = await this.s3Service.downloadToTemp(storageKey);
      await job.updateProgress(15);

      // Step 2: Extract keyframes
      this.logger.log('Step 2: Extracting keyframes with FFmpeg');
      const keyframeResult = await this.ffmpegService.extractKeyframes(tempVideoPath);
      tempOutputDir = keyframeResult.frames[0]?.replace(/\/[^/]+$/, '') || null;
      await job.updateProgress(30);

      // Limit frames if specified
      const framesToProcess = options?.maxFrames
        ? keyframeResult.frames.slice(0, options.maxFrames)
        : keyframeResult.frames;

      this.logger.log(`Extracted ${framesToProcess.length} frames`);

      // Step 3: Parallel OCR processing
      let ocrResults = null;
      if (!options?.skipOcr) {
        this.logger.log('Step 3: Running OCR with Tesseract');
        ocrResults = await this.ocrService.extractTextBatch(framesToProcess);
        await this.saveVideoEvents(mediaId, framesToProcess, ocrResults);

        // Extract visual cues (errors, URLs, component names) from combined OCR text
        const visualCues = extractVisualCues(ocrResults.totalText || '');
        await this.saveVisualCues(mediaId, visualCues);

        await job.updateProgress(50);
      }

      // Step 4: YOLO UI detection
      let uiDetections: any[] = [];
      if (!options?.skipYolo) {
        this.logger.log('Step 4: Running YOLO UI detection');
        uiDetections = await this.yoloService.detectBatch(framesToProcess);
        await job.updateProgress(65);
      }

      // Step 5: AI Vision analysis (multi-tenant, supports Anthropic + OpenAI)
      let visionAnalysis = null;
      if (!options?.skipVision) {
        this.logger.log('Step 5: Running AI Vision analysis');
        const fs = await import('fs/promises');
        const frameBuffers = await Promise.all(
          framesToProcess.map((fp) => fs.readFile(fp)),
        );
        const analysis = await this.openaiService.analyzeVideo(
          frameBuffers,
          tenantId,
          { ocrText: ocrResults?.totalText, uiDetections },
        );
        // Map VideoAnalysis → legacy visionAnalysis shape used by downstream code
        if (analysis) {
          visionAnalysis = {
            summary: analysis.summary,
            uiElements: analysis.uiElements,
            actions: analysis.reproSteps,
            errorMessages: analysis.errorMessages,
            recommendations: [],
          };
        }
        await job.updateProgress(80);
      }

      // Step 6: Generate embeddings
      this.logger.log('Step 6: Generating embeddings');
      const textForEmbedding = this.buildEmbeddingText(ocrResults?.totalText, visionAnalysis);
      const embeddings = await this.openaiService.generateEmbedding(textForEmbedding);
      await job.updateProgress(90);

      // Step 7: Update ticket in database
      this.logger.log('Step 7: Updating ticket in database');
      await this.updateTicket(ticketId, {
        aiSummary: visionAnalysis?.summary,
        aiAnalysis: {
          ocr: ocrResults,
          vision: visionAnalysis,
          uiDetections: uiDetections.slice(0, 100), // Limit stored detections
          metadata: keyframeResult.metadata,
        },
        keywords: visionAnalysis?.uiElements || [],
      });

      // Update media status
      await this.updateMediaStatus(mediaId, 'completed', null, {
        framesExtracted: framesToProcess.length,
        processingTimeMs: Date.now() - startTime,
        metadata: keyframeResult.metadata,
      });
      await job.updateProgress(95);

      // Step 7b: Store embedding vector in PostgreSQL (pgvector)
      if (embeddings.embedding?.length > 0) {
        try {
          await this.prisma.$executeRaw`
            UPDATE tickets SET embedding = ${JSON.stringify(embeddings.embedding)}::vector
            WHERE id = ${ticketId}
          `;
        } catch (embeddingError) {
          this.logger.warn(`Failed to store embedding for ticket ${ticketId}: ${getErrorMessage(embeddingError)}`);
        }
      }

      // Step 8: Index in Meilisearch
      this.logger.log('Step 8: Indexing in Meilisearch');
      await this.indexTicket(ticketId, tenantId, {
        ocrText: ocrResults?.totalText,
        summary: visionAnalysis?.summary,
        keywords: visionAnalysis?.uiElements,
        embedding: embeddings.embedding,
      });
      await job.updateProgress(100);

      const result: VideoAnalysisResult = {
        success: true,
        mediaId,
        ticketId,
        framesExtracted: framesToProcess.length,
        ocrResults: ocrResults
          ? {
              totalText: ocrResults.totalText,
              averageConfidence: ocrResults.averageConfidence,
            }
          : undefined,
        visionAnalysis: visionAnalysis
          ? {
              summary: visionAnalysis.summary,
              uiElements: visionAnalysis.uiElements,
              actions: visionAnalysis.actions,
              errorMessages: visionAnalysis.errorMessages,
              recommendations: visionAnalysis.recommendations,
            }
          : undefined,
        embeddings: {
          dimensions: embeddings.dimensions,
          vectorId: `${ticketId}-${mediaId}`,
        },
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.log(`Video analysis completed for ${mediaId} in ${result.processingTimeMs}ms`);

      return result;
    } catch (error) {
      this.logger.error(`Video analysis failed for ${mediaId}: ${getErrorMessage(error)}`, getErrorStack(error));

      // Update media status to failed
      await this.updateMediaStatus(mediaId, 'failed', getErrorMessage(error));

      return {
        success: false,
        mediaId,
        ticketId,
        framesExtracted: 0,
        processingTimeMs: Date.now() - startTime,
        error: getErrorMessage(error),
      };
    } finally {
      // Cleanup temp files
      await this.cleanup(tempVideoPath, tempOutputDir);
    }
  }

  /**
   * Update media processing status
   */
  private async updateMediaStatus(
    mediaId: string,
    status: string,
    error?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        processingStatus: status,
        processingError: error || null,
        ...(metadata && { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  }

  /**
   * Save video events (OCR text per frame)
   */
  private async saveVideoEvents(
    mediaId: string,
    framePaths: string[],
    ocrResults: any
  ): Promise<void> {
    const events = framePaths.map((framePath, index) => {
      // Extract timestamp from frame filename (e.g., frame-0001.png = 1000ms)
      const frameMatch = framePath.match(/frame-(\d+)\./);
      const frameNumber = frameMatch && frameMatch[1] ? parseInt(frameMatch[1], 10) : index + 1;
      const timestampMs = frameNumber * 1000; // 1 frame/sec

      return {
        mediaId,
        timestampMs,
        eventType: 'keyframe',
        ocrText: ocrResults.results[index]?.text || null,
        eventData: {
          confidence: ocrResults.results[index]?.confidence,
          frameIndex: index,
        },
      };
    });

    await this.prisma.videoEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
  }

  /**
   * Save extracted visual cues to media.metadata for use by DeepAnalysisService
   */
  private async saveVisualCues(mediaId: string, visualCues: VisualCues): Promise<void> {
    if (visualCues.errors.length === 0 && visualCues.urls.length === 0 && visualCues.components.length === 0) {
      return;
    }

    const existing = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { metadata: true },
    });

    const existingMetadata =
      existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        metadata: { ...existingMetadata, visualCues } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update ticket with analysis results
   */
  private async updateTicket(
    ticketId: string,
    data: {
      aiSummary?: string;
      aiAnalysis?: Record<string, unknown>;
      keywords?: string[];
    }
  ): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        aiSummary: data.aiSummary,
        aiAnalysis: data.aiAnalysis as Prisma.InputJsonValue,
        keywords: data.keywords || [],
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Build text for embedding generation
   */
  private buildEmbeddingText(ocrText?: string, visionAnalysis?: any): string {
    const parts: string[] = [];

    if (visionAnalysis?.summary) {
      parts.push(visionAnalysis.summary);
    }

    if (visionAnalysis?.actions?.length) {
      parts.push('Actions: ' + visionAnalysis.actions.join(', '));
    }

    if (visionAnalysis?.errorMessages?.length) {
      parts.push('Errors: ' + visionAnalysis.errorMessages.join(', '));
    }

    if (ocrText) {
      parts.push('Screen text: ' + ocrText.slice(0, 2000));
    }

    return parts.join('\n\n');
  }

  /**
   * Index ticket in Meilisearch
   */
  private async indexTicket(
    ticketId: string,
    tenantId: string,
    data: {
      ocrText?: string;
      summary?: string;
      keywords?: string[];
      embedding?: number[];
    }
  ): Promise<void> {
    await this.meilisearch.indexDocument('tickets', {
      id: ticketId,
      tenantId,
      ocrText: data.ocrText,
      summary: data.summary,
      keywords: data.keywords,
      _vectors: data.embedding,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(videoPath: string | null, outputDir: string | null): Promise<void> {
    try {
      if (videoPath) {
        const fs = await import('fs/promises');
        await fs.unlink(videoPath).catch(() => {});
      }
      if (outputDir) {
        const fs = await import('fs/promises');
        await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      this.logger.warn(`Cleanup failed: ${getErrorMessage(error)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job<VideoAnalysisJobData>) {
    this.logger.log(`Job ${job.id} started processing (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<VideoAnalysisJobData>, result: VideoAnalysisResult) {
    const duration = result.processingTimeMs;
    this.logger.log(`Job ${job.id} completed successfully in ${duration}ms`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<VideoAnalysisJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without job context: ${error.message}`);
      return;
    }

    const { mediaId } = job.data;
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 4;

    this.logger.error(
      `Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${getErrorMessage(error)}`,
      getErrorStack(error),
    );

    // If this was the last attempt, move to dead letter queue
    if (attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} exceeded max retries - moving to dead letter queue`);

      await this.deadLetterQueue.add(
        'failed-video-analysis',
        {
          originalJobId: job.id,
          queueName: QUEUE_NAMES.VIDEO_ANALYSIS,
          jobData: job.data,
          failedReason: error.message,
          stacktrace: error.stack,
          attemptsMade,
          timestamp: new Date().toISOString(),
        },
        {
          removeOnComplete: {
            age: 90 * 24 * 60 * 60, // 90 days
          },
        },
      );

      // Update media status to failed with retry information
      await this.updateMediaStatus(mediaId, 'failed', `Failed after ${attemptsMade} retries: ${error.message}`);
    } else {
      // Job will be retried
      const nextDelay = this.getNextRetryDelay(attemptsMade);
      this.logger.warn(`Job ${job.id} will retry in ${Math.round(nextDelay / 1000)}s`);
    }
  }

  /**
   * Calculate next retry delay based on attempt number
   */
  private getNextRetryDelay(attemptsMade: number): number {
    const delays: number[] = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
    const index = Math.max(0, Math.min(attemptsMade, delays.length - 1));
    return delays[index]!;
  }
}

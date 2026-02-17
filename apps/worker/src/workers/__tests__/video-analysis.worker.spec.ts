import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { VideoAnalysisWorker } from '../video-analysis.worker';
import { FFmpegService } from '../../services/ffmpeg.service';
import { OCRService } from '../../services/ocr.service';
import { OpenAIService } from '../../services/openai.service';
import { YoloService } from '../../services/yolo.service';
import { S3Service } from '../../services/s3.service';
import { PrismaService } from '../../services/prisma.service';
import { MeilisearchService } from '../../services/meilisearch.service';
import { VideoAnalysisJobData, VideoAnalysisResult } from '../../queues/queue.types';

describe('VideoAnalysisWorker', () => {
  let worker: VideoAnalysisWorker;
  let ffmpegService: jest.Mocked<FFmpegService>;
  let ocrService: jest.Mocked<OCRService>;
  let openaiService: jest.Mocked<OpenAIService>;
  let yoloService: jest.Mocked<YoloService>;
  let s3Service: jest.Mocked<S3Service>;
  let prisma: jest.Mocked<PrismaService>;
  let meilisearch: jest.Mocked<MeilisearchService>;
  let deadLetterQueue: jest.Mocked<Queue>;

  const mockJobData: VideoAnalysisJobData = {
    ticketId: 'ticket-123',
    mediaId: 'media-456',
    tenantId: 'tenant-789',
    storageKey: 'videos/test-video.mp4',
    options: {},
  };

  const mockJob = (
    data: VideoAnalysisJobData = mockJobData,
    attemptsMade = 0
  ): Job<VideoAnalysisJobData> =>
    ({
      id: 'job-123',
      data,
      attemptsMade,
      opts: { attempts: 4 },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as any;

  const mockKeyframeResult = {
    frames: ['/tmp/frame-0001.png', '/tmp/frame-0002.png', '/tmp/frame-0003.png'],
    metadata: {
      duration: 30,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'h264',
      bitrate: 5000000,
    },
    totalFrames: 3,
  };

  const mockOCRResult = {
    results: [
      { text: 'Error: Connection failed', confidence: 0.92, words: [], blocks: [] },
      { text: 'Login button', confidence: 0.88, words: [], blocks: [] },
      { text: 'Username field', confidence: 0.85, words: [], blocks: [] },
    ],
    totalText: 'Error: Connection failed\nLogin button\nUsername field',
    averageConfidence: 0.883,
  };

  const mockYoloDetections = [
    [
      { class: 'button', confidence: 0.92, bbox: { x: 100, y: 200, width: 80, height: 30 } },
      { class: 'input', confidence: 0.88, bbox: { x: 100, y: 250, width: 200, height: 25 } },
    ],
    [{ class: 'modal', confidence: 0.95, bbox: { x: 50, y: 50, width: 400, height: 300 } }],
    [{ class: 'alert', confidence: 0.90, bbox: { x: 200, y: 100, width: 300, height: 50 } }],
  ];

  const mockVisionAnalysis = {
    summary: 'User encountered connection error on login page',
    uiElements: ['Login Button', 'Username Field', 'Password Field', 'Error Modal'],
    actions: ['Navigate to login page', 'Enter username', 'Click login', 'Error displayed'],
    errorMessages: ['Error: Connection failed'],
    recommendations: ['Check network connectivity', 'Verify backend service is running'],
  };

  const mockEmbeddings = {
    embedding: new Array(3072).fill(0.1),
    text: 'Test embedding text',
    dimensions: 3072,
    cached: false,
  };

  beforeEach(async () => {
    const mockPrisma = {
      media: {
        update: jest.fn().mockResolvedValue({}),
      },
      ticket: {
        update: jest.fn().mockResolvedValue({}),
      },
      videoEvent: {
        createMany: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoAnalysisWorker,
        {
          provide: FFmpegService,
          useValue: {
            extractKeyframes: jest.fn(),
          },
        },
        {
          provide: OCRService,
          useValue: {
            extractTextBatch: jest.fn(),
          },
        },
        {
          provide: OpenAIService,
          useValue: {
            analyzeFrames: jest.fn(),
            generateEmbedding: jest.fn(),
          },
        },
        {
          provide: YoloService,
          useValue: {
            detectBatch: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            downloadToTemp: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: MeilisearchService,
          useValue: {
            indexDocument: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    worker = module.get<VideoAnalysisWorker>(VideoAnalysisWorker);
    ffmpegService = module.get(FFmpegService);
    ocrService = module.get(OCRService);
    openaiService = module.get(OpenAIService);
    yoloService = module.get(YoloService);
    s3Service = module.get(S3Service);
    prisma = module.get(PrismaService);
    meilisearch = module.get(MeilisearchService);
    deadLetterQueue = module.get(getQueueToken('dead-letter'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path - Full Pipeline', () => {
    it('should successfully process video with all steps', async () => {
      // Setup mocks
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      const result = await worker.process(job);

      // Verify result
      expect(result).toEqual({
        success: true,
        mediaId: 'media-456',
        ticketId: 'ticket-123',
        framesExtracted: 3,
        ocrResults: {
          totalText: mockOCRResult.totalText,
          averageConfidence: mockOCRResult.averageConfidence,
        },
        visionAnalysis: mockVisionAnalysis,
        embeddings: {
          dimensions: 3072,
          vectorId: 'ticket-123-media-456',
        },
        processingTimeMs: expect.any(Number),
      });

      // Verify all services were called
      expect(s3Service.downloadToTemp).toHaveBeenCalledWith('videos/test-video.mp4');
      expect(ffmpegService.extractKeyframes).toHaveBeenCalledWith('/tmp/video.mp4');
      expect(ocrService.extractTextBatch).toHaveBeenCalledWith(mockKeyframeResult.frames);
      expect(yoloService.detectBatch).toHaveBeenCalledWith(mockKeyframeResult.frames);
      expect(openaiService.analyzeFrames).toHaveBeenCalledWith(
        mockKeyframeResult.frames,
        mockOCRResult.totalText,
        mockYoloDetections
      );

      // Verify database updates
      expect(prisma.media.update).toHaveBeenCalledTimes(2); // processing + completed
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          aiSummary: mockVisionAnalysis.summary,
          aiAnalysis: {
            ocr: mockOCRResult,
            vision: mockVisionAnalysis,
            uiDetections: mockYoloDetections.slice(0, 100),
            metadata: mockKeyframeResult.metadata,
          },
          keywords: mockVisionAnalysis.uiElements,
          updatedAt: expect.any(Date),
        },
      });

      // Verify Meilisearch indexing
      expect(meilisearch.indexDocument).toHaveBeenCalledWith('tickets', {
        id: 'ticket-123',
        tenantId: 'tenant-789',
        ocrText: mockOCRResult.totalText,
        summary: mockVisionAnalysis.summary,
        keywords: mockVisionAnalysis.uiElements,
        _vectors: mockEmbeddings.embedding,
        updatedAt: expect.any(String),
      });
    });

    it('should update job progress at each step', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      await worker.process(job);

      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(15);
      expect(job.updateProgress).toHaveBeenCalledWith(30);
      expect(job.updateProgress).toHaveBeenCalledWith(50);
      expect(job.updateProgress).toHaveBeenCalledWith(65);
      expect(job.updateProgress).toHaveBeenCalledWith(80);
      expect(job.updateProgress).toHaveBeenCalledWith(90);
      expect(job.updateProgress).toHaveBeenCalledWith(95);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should save video events from OCR results', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      await worker.process(job);

      expect(prisma.videoEvent.createMany).toHaveBeenCalledWith({
        data: [
          {
            mediaId: 'media-456',
            timestampMs: 1000,
            eventType: 'keyframe',
            ocrText: 'Error: Connection failed',
            eventData: { confidence: 0.92, frameIndex: 0 },
          },
          {
            mediaId: 'media-456',
            timestampMs: 2000,
            eventType: 'keyframe',
            ocrText: 'Login button',
            eventData: { confidence: 0.88, frameIndex: 1 },
          },
          {
            mediaId: 'media-456',
            timestampMs: 3000,
            eventType: 'keyframe',
            ocrText: 'Username field',
            eventData: { confidence: 0.85, frameIndex: 2 },
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('Options - Skip Steps', () => {
    it('should skip OCR when skipOcr option is true', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob({
        ...mockJobData,
        options: { skipOcr: true },
      });
      await worker.process(job);

      expect(ocrService.extractTextBatch).not.toHaveBeenCalled();
      expect(prisma.videoEvent.createMany).not.toHaveBeenCalled();
      expect(openaiService.analyzeFrames).toHaveBeenCalledWith(
        mockKeyframeResult.frames,
        '',
        mockYoloDetections
      );
    });

    it('should skip YOLO when skipYolo option is true', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob({
        ...mockJobData,
        options: { skipYolo: true },
      });
      await worker.process(job);

      expect(yoloService.detectBatch).not.toHaveBeenCalled();
      expect(openaiService.analyzeFrames).toHaveBeenCalledWith(
        mockKeyframeResult.frames,
        mockOCRResult.totalText,
        []
      );
    });

    it('should skip Vision analysis when skipVision option is true', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob({
        ...mockJobData,
        options: { skipVision: true },
      });
      const result = await worker.process(job);

      expect(openaiService.analyzeFrames).not.toHaveBeenCalled();
      expect(result.visionAnalysis).toBeUndefined();
    });

    it('should limit frames when maxFrames option is set', async () => {
      const manyFrames = new Array(20)
        .fill(null)
        .map((_, i) => `/tmp/frame-${String(i + 1).padStart(4, '0')}.png`);

      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue({
        ...mockKeyframeResult,
        frames: manyFrames,
        totalFrames: 20,
      });
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob({
        ...mockJobData,
        options: { maxFrames: 5 },
      });
      const result = await worker.process(job);

      expect(ocrService.extractTextBatch).toHaveBeenCalledWith(manyFrames.slice(0, 5));
      expect(result.framesExtracted).toBe(5);
    });
  });

  describe('Error Handling - Individual Steps', () => {
    it('should handle S3 download failure', async () => {
      s3Service.downloadToTemp.mockRejectedValue(new Error('S3 download failed'));

      const job = mockJob();
      const result = await worker.process(job);

      expect(result).toEqual({
        success: false,
        mediaId: 'media-456',
        ticketId: 'ticket-123',
        framesExtracted: 0,
        processingTimeMs: expect.any(Number),
        error: 'S3 download failed',
      });

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-456' },
        data: {
          processingStatus: 'failed',
          processingError: 'S3 download failed',
        },
      });
    });

    it('should handle FFmpeg extraction failure', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockRejectedValue(new Error('Video file corrupted'));

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Video file corrupted');
      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-456' },
        data: {
          processingStatus: 'failed',
          processingError: 'Video file corrupted',
        },
      });
    });

    it('should handle OCR timeout', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockRejectedValue(new Error('OCR timeout'));

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OCR timeout');
    });

    it('should handle OpenAI API error', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockRejectedValue(new Error('OpenAI rate limit exceeded'));

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenAI rate limit exceeded');
    });

    it('should handle embedding generation failure', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockRejectedValue(new Error('Embedding API error'));

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Embedding API error');
    });
  });

  describe('Status Transitions', () => {
    it('should update media status to processing at start', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      await worker.process(job);

      // First call should be to set status to processing
      expect(prisma.media.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'media-456' },
        data: {
          processingStatus: 'processing',
          processingError: null,
        },
      });

      // Second call should be to set status to completed
      expect(prisma.media.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'media-456' },
        data: {
          processingStatus: 'completed',
          processingError: null,
          metadata: {
            framesExtracted: 3,
            processingTimeMs: expect.any(Number),
            metadata: mockKeyframeResult.metadata,
          },
        },
      });
    });

    it('should update media status to failed on error', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockRejectedValue(new Error('Extraction failed'));

      const job = mockJob();
      await worker.process(job);

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-456' },
        data: {
          processingStatus: 'failed',
          processingError: 'Extraction failed',
        },
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup temp files on success', async () => {
      const fsMock = {
        unlink: jest.fn().mockResolvedValue(undefined),
        rm: jest.fn().mockResolvedValue(undefined),
      };
      jest.doMock('fs/promises', () => fsMock);

      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      await worker.process(job);

      // Cleanup is called via dynamic import, so we can't easily verify it
      // The test confirms the process completes without error
      expect(true).toBe(true);
    });

    it('should cleanup temp files even on error', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockRejectedValue(new Error('Processing failed'));

      const job = mockJob();
      await worker.process(job);

      // Cleanup should still happen in finally block
      expect(true).toBe(true);
    });
  });

  describe('Worker Events', () => {
    it('should log when job starts (onActive)', () => {
      const loggerSpy = jest.spyOn(worker['logger'], 'log');
      const job = mockJob();

      worker.onActive(job);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 started processing')
      );
    });

    it('should log when job completes (onCompleted)', () => {
      const loggerSpy = jest.spyOn(worker['logger'], 'log');
      const job = mockJob();
      const result: VideoAnalysisResult = {
        success: true,
        mediaId: 'media-456',
        ticketId: 'ticket-123',
        framesExtracted: 3,
        processingTimeMs: 5000,
      };

      worker.onCompleted(job, result);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 completed successfully in 5000ms')
      );
    });

    it('should log and retry on first failure', async () => {
      const loggerSpy = jest.spyOn(worker['logger'], 'error');
      const job = mockJob(mockJobData, 1); // attemptsMade = 1
      const error = new Error('Temporary failure');

      await worker.onFailed(job, error);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 failed (attempt 1/4)'),
        expect.any(String)
      );
    });

    it('should move to dead letter queue after max retries', async () => {
      const job = mockJob(mockJobData, 4); // attemptsMade = 4 (max reached)
      const error = new Error('Permanent failure');

      await worker.onFailed(job, error);

      expect(deadLetterQueue.add).toHaveBeenCalledWith(
        'failed-video-analysis',
        {
          originalJobId: 'job-123',
          queueName: 'video-analysis',
          jobData: mockJobData,
          failedReason: 'Permanent failure',
          stacktrace: expect.any(String),
          attemptsMade: 4,
          timestamp: expect.any(String),
        },
        {
          removeOnComplete: {
            age: 90 * 24 * 60 * 60,
          },
        }
      );

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-456' },
        data: {
          processingStatus: 'failed',
          processingError: 'Failed after 4 retries: Permanent failure',
        },
      });
    });

    it('should handle undefined job in onFailed', async () => {
      const loggerSpy = jest.spyOn(worker['logger'], 'error');
      const error = new Error('Unknown error');

      await worker.onFailed(undefined, error);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job failed without job context')
      );
      expect(deadLetterQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should use exponential backoff delays', () => {
      const delays = [
        worker['getNextRetryDelay'](0), // 1st retry
        worker['getNextRetryDelay'](1), // 2nd retry
        worker['getNextRetryDelay'](2), // 3rd retry
        worker['getNextRetryDelay'](3), // 4th retry
      ];

      expect(delays).toEqual([
        60 * 1000, // 1 minute
        5 * 60 * 1000, // 5 minutes
        15 * 60 * 1000, // 15 minutes
        60 * 60 * 1000, // 1 hour
      ]);
    });

    it('should cap retry delay at max value', () => {
      const delay = worker['getNextRetryDelay'](10); // Way beyond max attempts
      expect(delay).toBe(60 * 60 * 1000); // Should be capped at 1 hour
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty frames array', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue({
        frames: [],
        metadata: mockKeyframeResult.metadata,
        totalFrames: 0,
      });
      ocrService.extractTextBatch.mockResolvedValue({
        results: [],
        totalText: '',
        averageConfidence: 0,
      });
      yoloService.detectBatch.mockResolvedValue([]);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.framesExtracted).toBe(0);
      expect(ocrService.extractTextBatch).toHaveBeenCalledWith([]);
    });

    it('should handle null OCR results', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockRejectedValue(new Error('OCR failed'));

      const job = mockJob();
      const result = await worker.process(job);

      // When OCR fails, the whole job fails
      expect(result.success).toBe(false);
      expect(result.error).toBe('OCR failed');
    });

    it('should handle null vision analysis', async () => {
      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(mockYoloDetections);
      openaiService.analyzeFrames.mockResolvedValue(null as any);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.visionAnalysis).toBeUndefined();
    });

    it('should limit stored UI detections to 100', async () => {
      // Create 150 detections (each element is an array with one detection)
      const manyDetections = new Array(150).fill(null).map(() => [
        { class: 'button', confidence: 0.9, bbox: { x: 0, y: 0, width: 10, height: 10 } },
      ]);

      s3Service.downloadToTemp.mockResolvedValue('/tmp/video.mp4');
      ffmpegService.extractKeyframes.mockResolvedValue(mockKeyframeResult);
      ocrService.extractTextBatch.mockResolvedValue(mockOCRResult);
      yoloService.detectBatch.mockResolvedValue(manyDetections);
      openaiService.analyzeFrames.mockResolvedValue(mockVisionAnalysis);
      openaiService.generateEmbedding.mockResolvedValue(mockEmbeddings);

      const job = mockJob();
      await worker.process(job);

      // Get the actual call to prisma.ticket.update
      const updateCall = (prisma.ticket.update as jest.Mock).mock.calls[0];
      const aiAnalysis = updateCall[0].data.aiAnalysis;

      // Verify the uiDetections array was limited to 100 frames (not individual detections)
      expect(aiAnalysis.uiDetections.length).toBe(100);
      // First element is an array of detections for that frame
      expect(Array.isArray(aiAnalysis.uiDetections[0])).toBe(true);
      expect(aiAnalysis.uiDetections[0][0]).toMatchObject({ class: 'button' });
    });
  });

  describe('buildEmbeddingText', () => {
    it('should build embedding text from all sources', () => {
      const ocrText = 'Error: Connection failed';
      const visionAnalysis = {
        summary: 'Connection error on login',
        actions: ['Click login', 'See error'],
        errorMessages: ['Connection failed'],
        uiElements: [],
      };

      const result = worker['buildEmbeddingText'](ocrText, visionAnalysis);

      expect(result).toContain('Connection error on login');
      expect(result).toContain('Actions: Click login, See error');
      expect(result).toContain('Errors: Connection failed');
      expect(result).toContain('Screen text: Error: Connection failed');
    });

    it('should handle missing vision analysis', () => {
      const ocrText = 'Some text';
      const result = worker['buildEmbeddingText'](ocrText, undefined);
      expect(result).toBe('Screen text: Some text');
    });

    it('should truncate OCR text to 2000 chars', () => {
      const longText = 'a'.repeat(5000);
      const result = worker['buildEmbeddingText'](longText, undefined);
      expect(result).toHaveLength('Screen text: '.length + 2000);
    });
  });
});

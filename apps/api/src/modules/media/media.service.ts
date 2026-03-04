import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { FFprobeService } from './ffprobe.service';
import { Queue } from 'bullmq';
import { RequestUploadUrlDto, CompleteUploadDto } from './dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  // File size limits by plan (in bytes)
  private readonly fileSizeLimits = {
    free: 500 * 1024 * 1024, // 500MB
    pro: 5000 * 1024 * 1024, // 5GB
    team: 10000 * 1024 * 1024, // 10GB
    enterprise: 50000 * 1024 * 1024, // 50GB
  };

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private ffprobeService: FFprobeService,
    @InjectQueue('video-analysis') private analysisQueue: Queue,
  ) {
    this.logger.log('MediaService initialized');
  }

  /**
   * Request presigned URL for file upload
   */
  async requestUploadUrl(tenantId: string, dto: RequestUploadUrlDto) {
    const { ticketId, type, filename, size, contentType } = dto;

    // Verify ticket exists and belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId,
      },
      include: {
        tenant: {
          select: {
            plan: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Validate file size based on tenant plan
    const planLimits = this.fileSizeLimits as Record<string, number>;
    const maxSize = planLimits[ticket.tenant.plan] || this.fileSizeLimits.free;
    if (size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit for ${ticket.tenant.plan} plan (max: ${Math.round(maxSize / (1024 * 1024))}MB)`,
      );
    }

    // Generate unique storage key
    const storageKey = this.s3Service.generateStorageKey(
      tenantId,
      ticketId,
      filename,
    );

    // Get presigned URL from S3
    const { uploadUrl, expiresIn } = await this.s3Service.getPresignedUploadUrl(
      storageKey,
      contentType,
      3600, // 1 hour expiry
    );

    // Create pending media record
    const media = await this.prisma.media.create({
      data: {
        ticketId,
        type,
        storageKey,
        fileSize: BigInt(size),
        mimeType: contentType,
        processingStatus: 'pending',
        metadata: {
          originalFilename: filename,
          uploadRequestedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `Generated upload URL for ticket ${ticketId}, media ${media.id}`,
    );

    return {
      mediaId: media.id,
      uploadUrl,
      storageKey,
      expiresIn,
      maxSize,
    };
  }

  /**
   * Complete upload and trigger AI analysis
   */
  async completeUpload(tenantId: string, dto: CompleteUploadDto) {
    const { mediaId, storageKey, checksum, metadata: clientMetadata } = dto;

    // Get media record
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        ticket: {
          tenantId,
        },
      },
      include: {
        ticket: true,
      },
    });

    if (!media) {
      throw new NotFoundException('Media record not found');
    }

    if (media.storageKey !== storageKey) {
      throw new BadRequestException('Storage key mismatch');
    }

    // Verify file exists in S3
    const exists = await this.s3Service.objectExists(storageKey);
    if (!exists) {
      throw new BadRequestException('File not found in storage');
    }

    // Get file metadata from S3
    const s3Metadata = await this.s3Service.getObjectMetadata(storageKey);

    // Verify checksum if provided
    if (checksum) {
      const isValid = await this.verifyChecksum(
        checksum,
        s3Metadata.etag,
        storageKey,
      );
      if (!isValid) {
        // Delete corrupted file
        await this.s3Service.deleteObject(storageKey);
        await this.prisma.media.delete({ where: { id: mediaId } });

        throw new BadRequestException(
          'File integrity check failed. Checksum mismatch. Please retry upload.',
        );
      }

      this.logger.log(
        `Checksum verified for ${mediaId}: ${checksum} matches S3 ETag`,
      );
    }

    // Extract video metadata if it's a video
    let videoMetadata = clientMetadata || {};
    if (media.type === 'video') {
      try {
        // Generate temporary download URL for FFprobe
        const downloadUrl = await this.s3Service.getPresignedDownloadUrl(
          storageKey,
          300, // 5 minutes expiry
          media.mimeType ?? undefined, // Pass MIME type for correct Content-Type
        );

        // Extract metadata
        const extracted = await this.ffprobeService.extractMetadata(downloadUrl);

        // Merge with client-provided metadata (server takes precedence)
        videoMetadata = {
          ...clientMetadata,
          ...extracted,
        };

        // Update duration field if available
        if (extracted.duration) {
          await this.prisma.media.update({
            where: { id: mediaId },
            data: {
              durationMs: Math.round(extracted.duration * 1000),
            },
          });
        }

        this.logger.log(
          `Extracted video metadata for ${mediaId}: ${extracted.width}x${extracted.height}, ${extracted.duration}s`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to extract video metadata for ${mediaId}:`,
          error,
        );
        // Continue without metadata - not critical
      }
    }

    // Update media record
    const existingMetadata = (media.metadata as Record<string, unknown>) || {};
    const updatedMedia = await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        processingStatus: 'uploaded',
        storageUrl: this.s3Service.getPublicUrl(storageKey),
        fileSize: BigInt(s3Metadata.contentLength || 0),
        metadata: {
          ...existingMetadata,
          uploadCompletedAt: new Date().toISOString(),
          s3Metadata,
          videoMetadata,
          ...(checksum && { checksum }),
        },
      },
    });

    this.logger.log(`Upload completed for media ${mediaId}`);

    // Enqueue AI analysis job if it's a video
    if (media.type === 'video') {
      await this.enqueueVideoAnalysis(mediaId, media.ticket.id, media.ticket.severity);
    }

    return {
      success: true,
      media: {
        id: updatedMedia.id,
        type: updatedMedia.type,
        status: updatedMedia.processingStatus,
        metadata: videoMetadata,
      },
    };
  }

  /**
   * Maps ticket severity to BullMQ priority (lower = higher priority).
   */
  private severityToBullMQPriority(severity: string | null | undefined): number {
    switch (severity) {
      case 'critical': return 1;
      case 'high':     return 2;
      case 'medium':   return 5;
      case 'low':      return 10;
      default:         return 5;
    }
  }

  /**
   * Enqueue video for AI analysis
   */
  private async enqueueVideoAnalysis(mediaId: string, ticketId: string, severity?: string | null) {
    const priority = this.severityToBullMQPriority(severity);

    try {
      await this.analysisQueue.add(
        'analyze-video',
        {
          mediaId,
          ticketId,
          timestamp: new Date().toISOString(),
        },
        {
          priority,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: {
            age: 7 * 24 * 60 * 60, // 7 days
            count: 100,
          },
        },
      );

      // Update media status
      await this.prisma.media.update({
        where: { id: mediaId },
        data: {
          processingStatus: 'processing',
        },
      });

      this.logger.log(`Enqueued video analysis for media ${mediaId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue video analysis: ${mediaId}`, error);
    }
  }

  /**
   * Get all media for a ticket
   */
  async findByTicket(ticketId: string, tenantId: string) {
    // Verify ticket belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const media = await this.prisma.media.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    // Generate download URLs for each media
    const mediaWithUrls = await Promise.all(
      media.map(async (m) => {
        let downloadUrl: string | null = null;

        if (m.processingStatus === 'uploaded' || m.processingStatus === 'completed') {
          try {
            downloadUrl = await this.s3Service.getPresignedDownloadUrl(
              m.storageKey,
              3600,
              m.mimeType ?? undefined, // Pass MIME type for correct Content-Type
            );
          } catch (error) {
            this.logger.warn(`Could not generate download URL for ${m.id}`);
          }
        }

        return {
          ...m,
          downloadUrl,
        };
      }),
    );

    return mediaWithUrls;
  }

  /**
   * Get single media with download URL
   */
  async findOne(mediaId: string, tenantId: string) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        ticket: {
          tenantId,
        },
      },
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Generate download URL
    let downloadUrl: string | null = null;
    if (media.processingStatus === 'uploaded' || media.processingStatus === 'completed') {
      try {
        downloadUrl = await this.s3Service.getPresignedDownloadUrl(
          media.storageKey,
          3600,
          media.mimeType ?? undefined, // Pass MIME type for correct Content-Type
        );
      } catch (error) {
        this.logger.warn(`Could not generate download URL for ${mediaId}`);
      }
    }

    return {
      ...media,
      downloadUrl,
    };
  }

  /**
   * Delete media
   */
  async remove(mediaId: string, tenantId: string) {
    const media = await this.findOne(mediaId, tenantId);

    // Delete from S3
    try {
      await this.s3Service.deleteObject(media.storageKey);
    } catch (error) {
      this.logger.error(`Failed to delete from S3: ${media.storageKey}`, error);
      // Continue with database deletion even if S3 delete fails
    }

    // Delete from database
    await this.prisma.media.delete({
      where: { id: mediaId },
    });

    this.logger.log(`Deleted media ${mediaId}`);

    return { success: true };
  }

  /**
   * Update media processing status (called by worker)
   */
  async updateProcessingStatus(
    mediaId: string,
    status: string,
    error?: string,
  ) {
    await this.prisma.media.update({
      where: { id: mediaId },
      data: {
        processingStatus: status,
        ...(error && { processingError: error }),
      },
    });

    this.logger.log(`Updated media ${mediaId} status to ${status}`);
  }

  /**
   * Cleanup old pending uploads (scheduled task)
   */
  async cleanupPendingUploads() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingMedia = await this.prisma.media.findMany({
      where: {
        processingStatus: 'pending',
        createdAt: {
          lt: oneHourAgo,
        },
      },
    });

    for (const media of pendingMedia) {
      // Check if file was never uploaded
      const exists = await this.s3Service.objectExists(media.storageKey);

      if (!exists) {
        // Delete orphaned media record
        await this.prisma.media.delete({
          where: { id: media.id },
        });

        this.logger.log(`Cleaned up orphaned media ${media.id}`);
      }
    }

    this.logger.log(`Cleaned up ${pendingMedia.length} pending uploads`);
  }

  /**
   * Get video events for a media item
   */
  async getVideoEvents(
    mediaId: string,
    tenantId: string,
    pagination: { limit: number; offset: number },
  ) {
    // Verify media belongs to tenant
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        ticket: { tenantId },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    const [events, total] = await Promise.all([
      this.prisma.videoEvent.findMany({
        where: { mediaId },
        orderBy: { timestampMs: 'asc' },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.videoEvent.count({ where: { mediaId } }),
    ]);

    return {
      data: events,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  /**
   * Get a presigned download URL for a storage key, with tenant verification
   */
  async getDownloadUrlByStorageKey(storageKey: string, tenantId: string): Promise<string> {
    const media = await this.prisma.media.findFirst({
      where: {
        storageKey,
        ticket: {
          tenantId,
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return this.s3Service.getPresignedDownloadUrl(storageKey, 3600, media.mimeType ?? undefined);
  }

  /**
   * Get presigned download URL for a media by ID
   */
  async getMediaDownloadUrl(mediaId: string, tenantId: string) {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        ticket: {
          tenantId,
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.processingStatus !== 'uploaded' && media.processingStatus !== 'completed') {
      throw new BadRequestException('Media is not ready for download');
    }

    const url = await this.s3Service.getPresignedDownloadUrl(
      media.storageKey,
      3600, // 1 hour expiry
      media.mimeType ?? undefined,
    );

    return {
      url,
      expiresIn: 3600,
    };
  }

  /**
   * Verify file checksum
   * Compares client checksum with S3 ETag
   * Note: S3 ETag is MD5 for simple uploads, but different for multipart uploads
   */
  private async verifyChecksum(
    clientChecksum: string,
    s3Etag: string | undefined,
    storageKey: string,
  ): Promise<boolean> {
    if (!s3Etag) {
      this.logger.warn(
        `No S3 ETag available for ${storageKey}, skipping checksum verification`,
      );
      return true; // Don't fail if ETag is missing
    }

    // Normalize checksums (remove quotes, lowercase)
    const normalizedClient = clientChecksum.toLowerCase().trim();
    const normalizedEtag = s3Etag.toLowerCase().trim();

    // Check if S3 ETag is from multipart upload (contains hyphen)
    if (normalizedEtag.includes('-')) {
      this.logger.warn(
        `S3 ETag ${normalizedEtag} is from multipart upload, cannot verify MD5 checksum`,
      );
      // For multipart uploads, we can't easily verify MD5
      // Could implement part-by-part verification if needed
      return true;
    }

    // For simple uploads, ETag is MD5 hash
    // Client checksum can be MD5 (32 chars) or SHA256 (64 chars)
    if (normalizedClient.length === 32) {
      // MD5 comparison
      const match = normalizedClient === normalizedEtag;
      if (!match) {
        this.logger.error(
          `Checksum mismatch: client=${normalizedClient}, S3=${normalizedEtag}`,
        );
      }
      return match;
    } else if (normalizedClient.length === 64) {
      // SHA256 provided but S3 uses MD5 - cannot verify
      this.logger.warn(
        `Client provided SHA256 but S3 ETag is MD5, skipping verification`,
      );
      return true;
    }

    this.logger.warn(`Invalid checksum format: ${clientChecksum}`);
    return true; // Don't fail on invalid format
  }

}

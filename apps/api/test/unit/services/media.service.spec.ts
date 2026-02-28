// Mock ffprobe service before imports to avoid TypeScript compilation issues
jest.mock('../../../src/modules/media/ffprobe.service');

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MediaService } from '../../../src/modules/media/media.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { S3Service } from '../../../src/modules/media/s3.service';
import { FFprobeService } from '../../../src/modules/media/ffprobe.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: jest.Mocked<PrismaService>;
  let s3Service: jest.Mocked<S3Service>;
  let ffprobeService: jest.Mocked<FFprobeService>;
  let analysisQueue: jest.Mocked<Queue>;

  const mockTicket = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    tenant: { plan: 'pro' },
  };

  const mockMedia = {
    id: 'media-123',
    ticketId: 'ticket-123',
    type: 'video',
    storageKey: 'tenant-123/ticket-123/file.mp4',
    fileSize: BigInt(1000000),
    mimeType: 'video/mp4',
    processingStatus: 'pending',
    metadata: {
      originalFilename: 'recording.mp4',
      uploadRequestedAt: new Date().toISOString(),
    },
    createdAt: new Date(),
    ticket: mockTicket,
    durationMs: null,
    storageUrl: null,
    processingError: null,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              findFirst: jest.fn(),
            },
            media: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            videoEvent: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: S3Service,
          useValue: {
            generateStorageKey: jest.fn(),
            getPresignedUploadUrl: jest.fn(),
            getPresignedDownloadUrl: jest.fn(),
            objectExists: jest.fn(),
            getObjectMetadata: jest.fn(),
            deleteObject: jest.fn(),
            getPublicUrl: jest.fn(),
          },
        },
        {
          provide: FFprobeService,
          useValue: {
            extractMetadata: jest.fn(),
          },
        },
        {
          provide: getQueueToken('video-analysis'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    prisma = module.get(PrismaService);
    s3Service = module.get(S3Service);
    ffprobeService = module.get(FFprobeService);
    analysisQueue = module.get(getQueueToken('video-analysis'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestUploadUrl', () => {
    const dto = {
      ticketId: 'ticket-123',
      type: 'video' as const,
      filename: 'recording.mp4',
      size: 10000000,
      contentType: 'video/mp4' as const,
    };

    it('should generate upload URL for valid request', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (s3Service.generateStorageKey as jest.Mock).mockReturnValue(
        'tenant-123/ticket-123/uuid.mp4',
      );
      (s3Service.getPresignedUploadUrl as jest.Mock).mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        expiresIn: 3600,
      });
      (prisma.media.create as jest.Mock).mockResolvedValue(mockMedia);

      const result = await service.requestUploadUrl('tenant-123', dto);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-123', tenantId: 'tenant-123' },
        include: { tenant: { select: { plan: true } } },
      });
      expect(result).toEqual({
        mediaId: 'media-123',
        uploadUrl: 'https://s3.example.com/upload',
        storageKey: 'tenant-123/ticket-123/uuid.mp4',
        expiresIn: 3600,
        maxSize: 5000 * 1024 * 1024, // pro plan limit
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.requestUploadUrl('tenant-123', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when file exceeds plan limit', async () => {
      const freePlanTicket = {
        ...mockTicket,
        tenant: { plan: 'free' },
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(freePlanTicket);

      const largeDto = { ...dto, size: 600 * 1024 * 1024 }; // 600MB

      await expect(
        service.requestUploadUrl('tenant-123', largeDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeUpload', () => {
    const dto = {
      mediaId: 'media-123',
      storageKey: 'tenant-123/ticket-123/file.mp4',
      checksum: 'd41d8cd98f00b204e9800998ecf8427e',
    };

    it('should complete upload for video file with metadata extraction', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMedia);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(true);
      (s3Service.getObjectMetadata as jest.Mock).mockResolvedValue({
        contentLength: 1000000,
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
      });
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );
      (ffprobeService.extractMetadata as jest.Mock).mockResolvedValue({
        duration: 120.5,
        width: 1920,
        height: 1080,
        codec: 'h264',
      });
      (s3Service.getPublicUrl as jest.Mock).mockReturnValue(
        'https://s3.example.com/public',
      );
      (prisma.media.update as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
        durationMs: 120500,
      });
      (analysisQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      const result = await service.completeUpload('tenant-123', dto);

      expect(s3Service.objectExists).toHaveBeenCalledWith(dto.storageKey);
      expect(ffprobeService.extractMetadata).toHaveBeenCalled();
      expect(prisma.media.update).toHaveBeenCalledTimes(3); // Duration + completion + processing status
      expect(analysisQueue.add).toHaveBeenCalledWith(
        'analyze-video',
        expect.objectContaining({
          mediaId: 'media-123',
          ticketId: 'ticket-123',
        }),
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.media.id).toBe('media-123');
    });

    it('should throw NotFoundException when media not found', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.completeUpload('tenant-123', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when storage key mismatch', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        storageKey: 'wrong-key.mp4',
      });

      await expect(
        service.completeUpload('tenant-123', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file not found in S3', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMedia);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(false);

      await expect(
        service.completeUpload('tenant-123', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete media and throw error on checksum mismatch', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMedia);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(true);
      (s3Service.getObjectMetadata as jest.Mock).mockResolvedValue({
        contentLength: 1000000,
        etag: 'wrongchecksum123',
      });
      (s3Service.deleteObject as jest.Mock).mockResolvedValue(undefined);
      (prisma.media.delete as jest.Mock).mockResolvedValue(mockMedia);

      await expect(
        service.completeUpload('tenant-123', dto),
      ).rejects.toThrow(BadRequestException);

      expect(s3Service.deleteObject).toHaveBeenCalledWith(dto.storageKey);
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: 'media-123' },
      });
    });

    it('should complete upload without video analysis for non-video files', async () => {
      const imageMedia = { ...mockMedia, type: 'image' };
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(imageMedia);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(true);
      (s3Service.getObjectMetadata as jest.Mock).mockResolvedValue({
        contentLength: 500000,
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
      });
      (s3Service.getPublicUrl as jest.Mock).mockReturnValue(
        'https://s3.example.com/public',
      );
      (prisma.media.update as jest.Mock).mockResolvedValue({
        ...imageMedia,
        processingStatus: 'uploaded',
      });

      const result = await service.completeUpload('tenant-123', dto);

      expect(ffprobeService.extractMetadata).not.toHaveBeenCalled();
      expect(analysisQueue.add).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('findByTicket', () => {
    it('should return media list with download URLs', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([
        { ...mockMedia, processingStatus: 'uploaded' },
      ]);
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.findByTicket('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0].downloadUrl).toBe('https://s3.example.com/download');
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByTicket('missing', 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when ticket belongs to different tenant', async () => {
      // ticket-123 belongs to tenant-A; querying with tenant-B returns null
      // because findByTicket filters by both ticketId AND tenantId
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByTicket('ticket-123', 'tenant-B'),
      ).rejects.toThrow(NotFoundException);

      // Confirm the Prisma call was scoped to tenant-B
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-123', tenantId: 'tenant-B' },
      });

      // No media should be fetched at all
      expect(prisma.media.findMany).not.toHaveBeenCalled();
    });

    it('should handle download URL generation errors gracefully', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.media.findMany as jest.Mock).mockResolvedValue([
        { ...mockMedia, processingStatus: 'uploaded' },
      ]);
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockRejectedValue(
        new Error('S3 error'),
      );

      const result = await service.findByTicket('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0].downloadUrl).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return media with download URL', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
        ticket: { id: 'ticket-123', title: 'Test Ticket' },
      });
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.findOne('media-123', 'tenant-123');

      expect(result.id).toBe('media-123');
      expect(result.downloadUrl).toBe('https://s3.example.com/download');
    });

    it('should throw NotFoundException when media not found', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null download URL for pending media', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'pending',
        ticket: { id: 'ticket-123', title: 'Test Ticket' },
      });

      const result = await service.findOne('media-123', 'tenant-123');

      expect(result.downloadUrl).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete media from S3 and database', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
        ticket: { id: 'ticket-123', title: 'Test Ticket' },
      });
      (s3Service.deleteObject as jest.Mock).mockResolvedValue(undefined);
      (prisma.media.delete as jest.Mock).mockResolvedValue(mockMedia);

      const result = await service.remove('media-123', 'tenant-123');

      expect(s3Service.deleteObject).toHaveBeenCalledWith(mockMedia.storageKey);
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: 'media-123' },
      });
      expect(result.success).toBe(true);
    });

    it('should continue with database deletion if S3 delete fails', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
        ticket: { id: 'ticket-123', title: 'Test Ticket' },
      });
      (s3Service.deleteObject as jest.Mock).mockRejectedValue(
        new Error('S3 error'),
      );
      (prisma.media.delete as jest.Mock).mockResolvedValue(mockMedia);

      const result = await service.remove('media-123', 'tenant-123');

      expect(prisma.media.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('updateProcessingStatus', () => {
    it('should update media status', async () => {
      (prisma.media.update as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'completed',
      });

      await service.updateProcessingStatus('media-123', 'completed');

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-123' },
        data: { processingStatus: 'completed' },
      });
    });

    it('should update media status with error', async () => {
      (prisma.media.update as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'failed',
        processingError: 'Analysis failed',
      });

      await service.updateProcessingStatus(
        'media-123',
        'failed',
        'Analysis failed',
      );

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-123' },
        data: {
          processingStatus: 'failed',
          processingError: 'Analysis failed',
        },
      });
    });
  });

  describe('cleanupPendingUploads', () => {
    it('should delete orphaned pending media records', async () => {
      const oldMedia = {
        ...mockMedia,
        processingStatus: 'pending',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };
      (prisma.media.findMany as jest.Mock).mockResolvedValue([oldMedia]);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(false);
      (prisma.media.delete as jest.Mock).mockResolvedValue(oldMedia);

      await service.cleanupPendingUploads();

      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: 'media-123' },
      });
    });

    it('should not delete pending uploads that exist in S3', async () => {
      const oldMedia = {
        ...mockMedia,
        processingStatus: 'pending',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };
      (prisma.media.findMany as jest.Mock).mockResolvedValue([oldMedia]);
      (s3Service.objectExists as jest.Mock).mockResolvedValue(true);

      await service.cleanupPendingUploads();

      expect(prisma.media.delete).not.toHaveBeenCalled();
    });
  });

  describe('getVideoEvents', () => {
    it('should return paginated video events', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMedia);
      (prisma.videoEvent.findMany as jest.Mock).mockResolvedValue([
        { id: 'event-1', timestampMs: 1000 },
        { id: 'event-2', timestampMs: 2000 },
      ]);
      (prisma.videoEvent.count as jest.Mock).mockResolvedValue(50);

      const result = await service.getVideoEvents('media-123', 'tenant-123', {
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'event-1' }),
        ]),
        total: 50,
        limit: 10,
        offset: 0,
      });
    });

    it('should throw NotFoundException when media not found', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getVideoEvents('missing', 'tenant-123', { limit: 10, offset: 0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrlByStorageKey', () => {
    it('should return download URL for valid storage key', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(mockMedia);
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.getDownloadUrlByStorageKey(
        'tenant-123/ticket-123/file.mp4',
        'tenant-123',
      );

      expect(result).toBe('https://s3.example.com/download');
    });

    it('should throw NotFoundException when media not found', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getDownloadUrlByStorageKey('missing-key', 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when storage key belongs to a different tenant', async () => {
      // The Prisma query filters by BOTH storageKey AND ticket.tenantId.
      // When the storage key exists but belongs to tenant-B, the query returns
      // null from tenant-A's perspective — simulating cross-tenant access denial.
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getDownloadUrlByStorageKey(
          'tenant-B/ticket-456/file.mp4', // key owned by a different tenant
          'tenant-A',                      // requesting tenant
        ),
      ).rejects.toThrow(NotFoundException);

      // Verify the query was called with the correct tenant isolation filter
      expect(prisma.media.findFirst).toHaveBeenCalledWith({
        where: {
          storageKey: 'tenant-B/ticket-456/file.mp4',
          ticket: {
            tenantId: 'tenant-A',
          },
        },
      });
    });
  });

  describe('getMediaDownloadUrl', () => {
    it('should return download URL for uploaded media', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
      });
      (s3Service.getPresignedDownloadUrl as jest.Mock).mockResolvedValue(
        'https://s3.example.com/download',
      );

      const result = await service.getMediaDownloadUrl('media-123', 'tenant-123');

      expect(result).toEqual({
        url: 'https://s3.example.com/download',
        expiresIn: 3600,
      });
    });

    it('should throw NotFoundException when media not found', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getMediaDownloadUrl('missing', 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when media not ready', async () => {
      (prisma.media.findFirst as jest.Mock).mockResolvedValue({
        ...mockMedia,
        processingStatus: 'pending',
      });

      await expect(
        service.getMediaDownloadUrl('media-123', 'tenant-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

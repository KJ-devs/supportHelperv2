import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';
import { FFprobeService } from './ffprobe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUploadUrlDto, CompleteUploadDto } from './dto';

describe('MediaController', () => {
  let controller: MediaController;
  let _mediaService: MediaService;
  let s3Service: S3Service;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-123';
  const mockTicketId = 'ticket-123';
  const mockMediaId = 'media-123';
  const mockStorageKey = 'tenants/tenant-123/tickets/ticket-123/video.mp4';

  const mockTicket = {
    id: mockTicketId,
    tenantId: mockTenantId,
    applicationId: 'app-123',
    title: 'Test Ticket',
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: {
      plan: 'free',
    },
  };

  const mockMedia = {
    id: mockMediaId,
    ticketId: mockTicketId,
    type: 'video',
    storageKey: mockStorageKey,
    storageUrl: 'https://s3.example.com/video.mp4',
    fileSize: BigInt(10000000),
    mimeType: 'video/mp4',
    durationMs: 30000,
    processingStatus: 'uploaded',
    processingError: null,
    metadata: {
      originalFilename: 'test-video.mp4',
    },
    createdAt: new Date(),
  };

  const mockPrismaService = {
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
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        's3.endpoint': 'http://localhost:9000',
        's3.accessKeyId': 'minioadmin',
        's3.secretAccessKey': 'minioadmin',
        's3.bucket': 'test-bucket',
        's3.region': 'us-east-1',
        'database.redisUrl': 'redis://localhost:6379',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,
        S3Service,
        FFprobeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    _mediaService = module.get<MediaService>(MediaService);
    s3Service = module.get<S3Service>(S3Service);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup handled by NestJS module
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestUploadUrl', () => {
    const requestDto: RequestUploadUrlDto = {
      ticketId: mockTicketId,
      type: 'video',
      filename: 'test-video.mp4',
      size: 100 * 1024 * 1024, // 100MB
      contentType: 'video/mp4',
    };

    it('should generate presigned upload URL', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.media.create.mockResolvedValue(mockMedia);
      jest.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned-url',
        storageKey: mockStorageKey,
        expiresIn: 3600,
      });

      const result = await controller.requestUploadUrl(mockTenantId, requestDto);

      expect(result).toHaveProperty('mediaId');
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('storageKey');
      expect(result).toHaveProperty('expiresIn', 3600);
      expect(result).toHaveProperty('maxSize');
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTicketId,
          tenantId: mockTenantId,
        },
        include: {
          tenant: {
            select: {
              plan: true,
            },
          },
        },
      });
    });

    it('should enforce file size limits based on tenant plan', async () => {
      const largeSizeDto = {
        ...requestDto,
        size: 600 * 1024 * 1024, // 600MB (exceeds free plan limit)
      };

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);

      await expect(
        controller.requestUploadUrl(mockTenantId, largeSizeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        controller.requestUploadUrl(mockTenantId, requestDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        controller.requestUploadUrl('different-tenant', requestDto),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'different-tenant',
          }),
        }),
      );
    });

    it('should validate video file types', async () => {
      const validTypes: Array<'video/mp4' | 'video/webm' | 'video/quicktime'> = ['video/mp4', 'video/webm', 'video/quicktime'];

      for (const contentType of validTypes) {
        mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
        mockPrismaService.media.create.mockResolvedValue(mockMedia);
        jest.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue({
          uploadUrl: 'https://s3.example.com/presigned-url',
          storageKey: mockStorageKey,
          expiresIn: 3600,
        });

        await expect(
          controller.requestUploadUrl(mockTenantId, {
            ...requestDto,
            contentType,
          }),
        ).resolves.toBeDefined();
      }
    });

    it('should handle different plan limits correctly', async () => {
      const plans = [
        { plan: 'free', maxSize: 500 * 1024 * 1024 },
        { plan: 'pro', maxSize: 5000 * 1024 * 1024 },
        { plan: 'team', maxSize: 10000 * 1024 * 1024 },
        { plan: 'enterprise', maxSize: 50000 * 1024 * 1024 },
      ];

      for (const { plan, maxSize } of plans) {
        const ticketWithPlan = {
          ...mockTicket,
          tenant: { plan },
        };

        mockPrismaService.ticket.findFirst.mockResolvedValue(ticketWithPlan);
        mockPrismaService.media.create.mockResolvedValue(mockMedia);
        jest.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue({
          uploadUrl: 'https://s3.example.com/presigned-url',
          storageKey: mockStorageKey,
          expiresIn: 3600,
        });

        const result = await controller.requestUploadUrl(mockTenantId, {
          ...requestDto,
          size: maxSize - 1000, // Just under limit
        });

        expect(result.maxSize).toBe(maxSize);
      }
    });
  });

  describe('completeUpload', () => {
    const completeDto: CompleteUploadDto = {
      mediaId: mockMediaId,
      storageKey: mockStorageKey,
      checksum: 'd41d8cd98f00b204e9800998ecf8427e', // MD5
      metadata: {
        duration: 30,
        width: 1920,
        height: 1080,
      },
    };

    it('should complete upload and return success', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: mockTicket,
        processingStatus: 'pending',
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      mockPrismaService.media.update.mockResolvedValue({
        ...mediaWithTicket,
        processingStatus: 'uploaded',
      });

      jest.spyOn(s3Service, 'objectExists').mockResolvedValue(true);
      jest.spyOn(s3Service, 'getObjectMetadata').mockResolvedValue({
        contentLength: 10000000,
        contentType: 'video/mp4',
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
        lastModified: new Date(),
        metadata: {},
      });
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue(
        'https://download-url',
      );

      const result = await controller.completeUpload(mockTenantId, completeDto);

      expect(result.success).toBe(true);
      expect(result.media).toBeDefined();
      expect(result.media.status).toBe('uploaded');
    });

    it('should throw NotFoundException if media record not found', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(
        controller.completeUpload(mockTenantId, completeDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if storage key mismatch', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        storageKey: 'different-key',
        ticket: mockTicket,
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);

      await expect(
        controller.completeUpload(mockTenantId, completeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file not found in S3', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: mockTicket,
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      jest.spyOn(s3Service, 'objectExists').mockResolvedValue(false);

      await expect(
        controller.completeUpload(mockTenantId, completeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify checksum and reject on mismatch', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: mockTicket,
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      jest.spyOn(s3Service, 'objectExists').mockResolvedValue(true);
      jest.spyOn(s3Service, 'getObjectMetadata').mockResolvedValue({
        contentLength: 10000000,
        contentType: 'video/mp4',
        etag: 'different-checksum',
        lastModified: new Date(),
        metadata: {},
      });
      jest.spyOn(s3Service, 'deleteObject').mockResolvedValue();

      await expect(
        controller.completeUpload(mockTenantId, completeDto),
      ).rejects.toThrow(BadRequestException);

      // Verify corrupted file was deleted
      expect(s3Service.deleteObject).toHaveBeenCalledWith(mockStorageKey);
    });

    it('should handle upload without checksum', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: mockTicket,
        processingStatus: 'pending',
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      mockPrismaService.media.update.mockResolvedValue({
        ...mediaWithTicket,
        processingStatus: 'uploaded',
      });

      jest.spyOn(s3Service, 'objectExists').mockResolvedValue(true);
      jest.spyOn(s3Service, 'getObjectMetadata').mockResolvedValue({
        contentLength: 10000000,
        contentType: 'video/mp4',
        etag: 'some-etag',
        lastModified: new Date(),
        metadata: {},
      });
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue(
        'https://download-url',
      );

      const dtoWithoutChecksum = {
        mediaId: mockMediaId,
        storageKey: mockStorageKey,
      };

      const result = await controller.completeUpload(
        mockTenantId,
        dtoWithoutChecksum,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('findByTicket', () => {
    it('should return all media for a ticket', async () => {
      const mediaList = [mockMedia, { ...mockMedia, id: 'media-456' }];

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.media.findMany.mockResolvedValue(mediaList);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://download-url');

      const result = await controller.findByTicket(mockTenantId, mockTicketId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('downloadUrl');
      expect(prisma.media.findMany).toHaveBeenCalledWith({
        where: { ticketId: mockTicketId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        controller.findByTicket(mockTenantId, mockTicketId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        controller.findByTicket('different-tenant', mockTicketId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return media with download URL', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: {
          id: mockTicketId,
          title: 'Test Ticket',
        },
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://download-url');

      const result = await controller.findOne(mockTenantId, mockMediaId);

      expect(result).toHaveProperty('downloadUrl');
      expect(result.id).toBe(mockMediaId);
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(
        controller.findOne(mockTenantId, mockMediaId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(
        controller.findOne('different-tenant', mockMediaId),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.media.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ticket: {
              tenantId: 'different-tenant',
            },
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete media from S3 and database', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: {
          id: mockTicketId,
          title: 'Test Ticket',
        },
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      jest.spyOn(s3Service, 'deleteObject').mockResolvedValue();
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);

      const result = await controller.remove(mockTenantId, mockMediaId);

      expect(result.success).toBe(true);
      expect(s3Service.deleteObject).toHaveBeenCalledWith(mockStorageKey);
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: mockMediaId },
      });
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(
        controller.remove(mockTenantId, mockMediaId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete from DB even if S3 delete fails', async () => {
      const mediaWithTicket = {
        ...mockMedia,
        ticket: {
          id: mockTicketId,
          title: 'Test Ticket',
        },
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      jest
        .spyOn(s3Service, 'deleteObject')
        .mockRejectedValue(new Error('S3 error'));
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);

      const result = await controller.remove(mockTenantId, mockMediaId);

      expect(result.success).toBe(true);
      expect(prisma.media.delete).toHaveBeenCalled();
    });
  });

  describe('Integration - Full upload workflow', () => {
    it('should handle complete upload workflow', async () => {
      // 1. Request upload URL
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.media.create.mockResolvedValue({
        ...mockMedia,
        processingStatus: 'pending',
      });
      jest.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned-url',
        storageKey: mockStorageKey,
        expiresIn: 3600,
      });

      const requestDto: RequestUploadUrlDto = {
        ticketId: mockTicketId,
        type: 'video',
        filename: 'test-video.mp4',
        size: 100 * 1024 * 1024,
        contentType: 'video/mp4',
      };

      const uploadResponse = await controller.requestUploadUrl(
        mockTenantId,
        requestDto,
      );

      expect(uploadResponse).toHaveProperty('uploadUrl');
      expect(uploadResponse).toHaveProperty('mediaId');

      // 2. Complete upload
      const mediaWithTicket = {
        ...mockMedia,
        id: uploadResponse.mediaId,
        storageKey: uploadResponse.storageKey,
        ticket: mockTicket,
        processingStatus: 'pending',
      };

      mockPrismaService.media.findFirst.mockResolvedValue(mediaWithTicket);
      mockPrismaService.media.update.mockResolvedValue({
        ...mediaWithTicket,
        processingStatus: 'uploaded',
      });

      jest.spyOn(s3Service, 'objectExists').mockResolvedValue(true);
      jest.spyOn(s3Service, 'getObjectMetadata').mockResolvedValue({
        contentLength: 100 * 1024 * 1024,
        contentType: 'video/mp4',
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
        lastModified: new Date(),
        metadata: {},
      });
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue(
        'https://download-url',
      );

      const completeDto: CompleteUploadDto = {
        mediaId: uploadResponse.mediaId,
        storageKey: uploadResponse.storageKey,
        checksum: 'd41d8cd98f00b204e9800998ecf8427e',
      };

      const completeResponse = await controller.completeUpload(
        mockTenantId,
        completeDto,
      );

      expect(completeResponse.success).toBe(true);
      expect(completeResponse.media.status).toBe('uploaded');

      // 3. Retrieve media
      mockPrismaService.media.findFirst.mockResolvedValue({
        ...mediaWithTicket,
        processingStatus: 'uploaded',
        ticket: {
          id: mockTicketId,
          title: 'Test Ticket',
        },
      });

      const retrievedMedia = await controller.findOne(
        mockTenantId,
        uploadResponse.mediaId,
      );

      expect(retrievedMedia.id).toBe(uploadResponse.mediaId);
      expect(retrievedMedia).toHaveProperty('downloadUrl');
    });
  });
});

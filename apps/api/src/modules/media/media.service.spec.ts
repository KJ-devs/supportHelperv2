import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { FFprobeService } from './ffprobe.service';

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit: jest.fn(),
  }));
});

describe('MediaService', () => {
  let service: MediaService;
  let prismaService: PrismaService;
  let s3Service: S3Service;
  let ffprobeService: FFprobeService;

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

  const mockS3Service = {
    generateStorageKey: jest.fn(),
    getPresignedUploadUrl: jest.fn(),
    getPresignedDownloadUrl: jest.fn(),
    objectExists: jest.fn(),
    getObjectMetadata: jest.fn(),
    deleteObject: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  const mockFFprobeService = {
    extractMetadata: jest.fn(),
    isVideo: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'database.redisUrl': 'redis://localhost:6379',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: FFprobeService,
          useValue: mockFFprobeService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    prismaService = module.get<PrismaService>(PrismaService);
    s3Service = module.get<S3Service>(S3Service);
    ffprobeService = module.get<FFprobeService>(FFprobeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestUploadUrl', () => {
    const mockTenantId = 'tenant-123';
    const mockTicketId = 'ticket-123';
    const mockDto = {
      ticketId: mockTicketId,
      type: 'video' as const,
      filename: 'test.mp4',
      size: 10000000,
      contentType: 'video/mp4' as const,
    };

    it('should generate upload URL for valid request', async () => {
      const mockTicket = {
        id: mockTicketId,
        tenantId: mockTenantId,
        tenant: { plan: 'free' },
      };

      const mockMedia = {
        id: 'media-123',
        ticketId: mockTicketId,
        type: 'video',
        storageKey: 'storage-key',
      };

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockS3Service.generateStorageKey.mockReturnValue('storage-key');
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        storageKey: 'storage-key',
        expiresIn: 3600,
      });
      mockPrismaService.media.create.mockResolvedValue(mockMedia);

      const result = await service.requestUploadUrl(mockTenantId, mockDto);

      expect(result).toHaveProperty('mediaId', 'media-123');
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('storageKey', 'storage-key');
      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: mockTicketId, tenantId: mockTenantId },
        include: { tenant: { select: { plan: true } } },
      });
      expect(mockPrismaService.media.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.requestUploadUrl(mockTenantId, mockDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.requestUploadUrl(mockTenantId, mockDto),
      ).rejects.toThrow('Ticket not found');
    });

    it('should throw BadRequestException if file too large', async () => {
      const mockTicket = {
        id: mockTicketId,
        tenantId: mockTenantId,
        tenant: { plan: 'free' },
      };

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);

      const largeFileDto = {
        ...mockDto,
        size: 600 * 1024 * 1024, // 600MB (exceeds free plan limit)
      };

      await expect(
        service.requestUploadUrl(mockTenantId, largeFileDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.requestUploadUrl(mockTenantId, largeFileDto),
      ).rejects.toThrow(/File size exceeds limit/);
    });

    it('should allow larger files for pro plan', async () => {
      const mockTicket = {
        id: mockTicketId,
        tenantId: mockTenantId,
        tenant: { plan: 'pro' },
      };

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockS3Service.generateStorageKey.mockReturnValue('storage-key');
      mockS3Service.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        storageKey: 'storage-key',
        expiresIn: 3600,
      });
      mockPrismaService.media.create.mockResolvedValue({ id: 'media-123' });

      const largeFileDto = {
        ...mockDto,
        size: 1000 * 1024 * 1024, // 1GB (allowed for pro)
      };

      const result = await service.requestUploadUrl(mockTenantId, largeFileDto);

      expect(result).toHaveProperty('mediaId');
    });
  });

  describe('completeUpload', () => {
    const mockTenantId = 'tenant-123';
    const mockMediaId = 'media-123';
    const mockStorageKey = 'storage-key';

    const mockDto = {
      mediaId: mockMediaId,
      storageKey: mockStorageKey,
      checksum: 'd41d8cd98f00b204e9800998ecf8427e',
    };

    const mockMedia = {
      id: mockMediaId,
      storageKey: mockStorageKey,
      type: 'video',
      ticket: { id: 'ticket-123', tenantId: mockTenantId },
      metadata: {},
    };

    it('should complete upload successfully', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(mockMedia);
      mockS3Service.objectExists.mockResolvedValue(true);
      mockS3Service.getObjectMetadata.mockResolvedValue({
        contentLength: 1000000,
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
      });
      mockS3Service.getPublicUrl.mockReturnValue('https://s3.example.com/file');
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(
        'https://s3.example.com/download',
      );
      mockFFprobeService.extractMetadata.mockResolvedValue({
        duration: 120.5,
        width: 1920,
        height: 1080,
        codec: 'h264',
      });
      mockPrismaService.media.update.mockResolvedValue({
        ...mockMedia,
        processingStatus: 'uploaded',
      });

      const result = await service.completeUpload(mockTenantId, mockDto);

      expect(result).toHaveProperty('success', true);
      expect(result.media).toHaveProperty('id', mockMediaId);
      expect(mockPrismaService.media.update).toHaveBeenCalled();
      expect(mockFFprobeService.extractMetadata).toHaveBeenCalled();
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(null);

      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow('Media record not found');
    });

    it('should throw BadRequestException if storage key mismatch', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue({
        ...mockMedia,
        storageKey: 'different-key',
      });

      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow('Storage key mismatch');
    });

    it('should throw BadRequestException if file not found in S3', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(mockMedia);
      mockS3Service.objectExists.mockResolvedValue(false);

      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeUpload(mockTenantId, mockDto),
      ).rejects.toThrow('File not found in storage');
    });

    it('should verify checksum and reject if mismatch', async () => {
      mockPrismaService.media.findFirst.mockResolvedValue(mockMedia);
      mockS3Service.objectExists.mockResolvedValue(true);
      mockS3Service.getObjectMetadata.mockResolvedValue({
        contentLength: 1000000,
        etag: 'aaaabbbbccccddddeeeeffffggggaaaa', // Different MD5 hash
      });

      const dtoWithChecksum = {
        ...mockDto,
        checksum: 'd41d8cd98f00b204e9800998ecf8427e', // Client MD5
      };

      await expect(
        service.completeUpload(mockTenantId, dtoWithChecksum),
      ).rejects.toThrow(BadRequestException);

      expect(mockS3Service.deleteObject).toHaveBeenCalledWith(mockStorageKey);
      expect(mockPrismaService.media.delete).toHaveBeenCalledWith({
        where: { id: mockMediaId },
      });
    });

    it('should skip metadata extraction for non-video files', async () => {
      const imageMedia = { ...mockMedia, type: 'image' };
      mockPrismaService.media.findFirst.mockResolvedValue(imageMedia);
      mockS3Service.objectExists.mockResolvedValue(true);
      mockS3Service.getObjectMetadata.mockResolvedValue({
        contentLength: 100000,
        etag: 'd41d8cd98f00b204e9800998ecf8427e',
      });
      mockS3Service.getPublicUrl.mockReturnValue('https://s3.example.com/file');
      mockPrismaService.media.update.mockResolvedValue({
        ...imageMedia,
        processingStatus: 'uploaded',
      });

      await service.completeUpload(mockTenantId, mockDto);

      expect(mockFFprobeService.extractMetadata).not.toHaveBeenCalled();
    });
  });

  describe('findByTicket', () => {
    const mockTenantId = 'tenant-123';
    const mockTicketId = 'ticket-123';

    it('should return media for ticket', async () => {
      const mockTicket = { id: mockTicketId, tenantId: mockTenantId };
      const mockMediaList = [
        {
          id: 'media-1',
          ticketId: mockTicketId,
          storageKey: 'key-1',
          processingStatus: 'uploaded',
        },
        {
          id: 'media-2',
          ticketId: mockTicketId,
          storageKey: 'key-2',
          processingStatus: 'completed',
        },
      ];

      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.media.findMany.mockResolvedValue(mockMediaList);
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue(
        'https://download-url',
      );

      const result = await service.findByTicket(mockTicketId, mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('downloadUrl');
      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: mockTicketId, tenantId: mockTenantId },
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.findByTicket(mockTicketId, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const mockTenantId = 'tenant-123';
    const mockMediaId = 'media-123';

    it('should delete media from S3 and database', async () => {
      const mockMedia = {
        id: mockMediaId,
        storageKey: 'storage-key',
        processingStatus: 'uploaded',
        ticket: { id: 'ticket-123' },
      };

      // Mock findOne (uses findFirst internally)
      mockPrismaService.media.findFirst.mockResolvedValue(mockMedia);
      mockS3Service.getPresignedDownloadUrl.mockResolvedValue('https://url');
      mockS3Service.deleteObject.mockResolvedValue(undefined);
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);

      const result = await service.remove(mockMediaId, mockTenantId);

      expect(result).toEqual({ success: true });
      expect(mockS3Service.deleteObject).toHaveBeenCalledWith('storage-key');
      expect(mockPrismaService.media.delete).toHaveBeenCalledWith({
        where: { id: mockMediaId },
      });
    });
  });
});

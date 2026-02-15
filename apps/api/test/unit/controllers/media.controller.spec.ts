import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from '../../../src/modules/media/media.controller';
import { MediaService } from '../../../src/modules/media/media.service';
import { Response } from 'express';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: jest.Mocked<MediaService>;

  const mockUploadResponse = {
    mediaId: 'media-123',
    uploadUrl: 'https://s3.example.com/upload',
    storageKey: 'tenant-123/ticket-123/uuid.mp4',
    expiresIn: 3600,
    maxSize: 500 * 1024 * 1024,
  };

  const mockCompleteResponse = {
    success: true,
    media: {
      id: 'media-123',
      type: 'video',
      status: 'uploaded',
      metadata: {
        duration: 120.5,
        width: 1920,
        height: 1080,
      },
    },
  };

  const mockMedia = {
    id: 'media-123',
    ticketId: 'ticket-123',
    type: 'video',
    storageKey: 'tenant-123/ticket-123/file.mp4',
    fileSize: BigInt(1000000),
    mimeType: 'video/mp4',
    processingStatus: 'uploaded',
    downloadUrl: 'https://s3.example.com/download',
    ticket: {
      id: 'ticket-123',
      title: 'Test Ticket',
    },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: {
            requestUploadUrl: jest.fn(),
            completeUpload: jest.fn(),
            findByTicket: jest.fn(),
            findOne: jest.fn(),
            getMediaDownloadUrl: jest.fn(),
            getDownloadUrlByStorageKey: jest.fn(),
            getVideoEvents: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestUploadUrl', () => {
    it('should request presigned upload URL', async () => {
      const dto = {
        ticketId: 'ticket-123',
        type: 'video' as const,
        filename: 'recording.mp4',
        size: 10000000,
        contentType: 'video/mp4' as const,
      };
      (mediaService.requestUploadUrl as jest.Mock).mockResolvedValue(
        mockUploadResponse,
      );

      const result = await controller.requestUploadUrl('tenant-123', dto);

      expect(mediaService.requestUploadUrl).toHaveBeenCalledWith(
        'tenant-123',
        dto,
      );
      expect(result).toEqual(mockUploadResponse);
    });

    it('should handle errors from service', async () => {
      const dto = {
        ticketId: 'ticket-123',
        type: 'video' as const,
        filename: 'recording.mp4',
        size: 10000000,
        contentType: 'video/mp4' as const,
      };
      (mediaService.requestUploadUrl as jest.Mock).mockRejectedValue(
        new Error('Service error'),
      );

      await expect(
        controller.requestUploadUrl('tenant-123', dto),
      ).rejects.toThrow('Service error');
    });
  });

  describe('completeUpload', () => {
    it('should complete upload successfully', async () => {
      const dto = {
        mediaId: 'media-123',
        storageKey: 'tenant-123/ticket-123/file.mp4',
        checksum: 'd41d8cd98f00b204e9800998ecf8427e',
      };
      (mediaService.completeUpload as jest.Mock).mockResolvedValue(
        mockCompleteResponse,
      );

      const result = await controller.completeUpload('tenant-123', dto);

      expect(mediaService.completeUpload).toHaveBeenCalledWith('tenant-123', dto);
      expect(result).toEqual(mockCompleteResponse);
    });

    it('should complete upload without checksum', async () => {
      const dto = {
        mediaId: 'media-123',
        storageKey: 'tenant-123/ticket-123/file.mp4',
      };
      (mediaService.completeUpload as jest.Mock).mockResolvedValue(
        mockCompleteResponse,
      );

      const result = await controller.completeUpload('tenant-123', dto);

      expect(mediaService.completeUpload).toHaveBeenCalledWith('tenant-123', dto);
      expect(result.success).toBe(true);
    });

    it('should handle errors from service', async () => {
      const dto = {
        mediaId: 'media-123',
        storageKey: 'tenant-123/ticket-123/file.mp4',
      };
      (mediaService.completeUpload as jest.Mock).mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(
        controller.completeUpload('tenant-123', dto),
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('findByTicket', () => {
    it('should return media list for ticket', async () => {
      (mediaService.findByTicket as jest.Mock).mockResolvedValue([mockMedia]);

      const result = await controller.findByTicket('tenant-123', 'ticket-123');

      expect(mediaService.findByTicket).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('media-123');
    });

    it('should return empty array when no media found', async () => {
      (mediaService.findByTicket as jest.Mock).mockResolvedValue([]);

      const result = await controller.findByTicket('tenant-123', 'ticket-123');

      expect(result).toEqual([]);
    });

    it('should handle errors from service', async () => {
      (mediaService.findByTicket as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        controller.findByTicket('tenant-123', 'missing'),
      ).rejects.toThrow('Not found');
    });
  });

  describe('findOne', () => {
    it('should return single media with download URL', async () => {
      (mediaService.findOne as jest.Mock).mockResolvedValue(mockMedia);

      const result = await controller.findOne('tenant-123', 'media-123');

      expect(mediaService.findOne).toHaveBeenCalledWith('media-123', 'tenant-123');
      expect(result).toEqual(mockMedia);
    });

    it('should handle errors from service', async () => {
      (mediaService.findOne as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        controller.findOne('tenant-123', 'missing'),
      ).rejects.toThrow('Not found');
    });
  });

  describe('getMediaUrl', () => {
    it('should return presigned download URL', async () => {
      const urlResponse = {
        url: 'https://s3.example.com/download',
        expiresIn: 3600,
      };
      (mediaService.getMediaDownloadUrl as jest.Mock).mockResolvedValue(
        urlResponse,
      );

      const result = await controller.getMediaUrl('tenant-123', 'media-123');

      expect(mediaService.getMediaDownloadUrl).toHaveBeenCalledWith(
        'media-123',
        'tenant-123',
      );
      expect(result).toEqual(urlResponse);
    });

    it('should handle errors from service', async () => {
      (mediaService.getMediaDownloadUrl as jest.Mock).mockRejectedValue(
        new Error('Media not ready'),
      );

      await expect(
        controller.getMediaUrl('tenant-123', 'media-123'),
      ).rejects.toThrow('Media not ready');
    });
  });

  describe('download', () => {
    it('should redirect to presigned download URL', async () => {
      const storageKey = 'tenant-123/ticket-123/file.mp4';
      const downloadUrl = 'https://s3.example.com/download';
      (mediaService.getDownloadUrlByStorageKey as jest.Mock).mockResolvedValue(
        downloadUrl,
      );

      const mockResponse = {
        redirect: jest.fn(),
      } as unknown as Response;

      await controller.download(storageKey, 'tenant-123', mockResponse);

      expect(mediaService.getDownloadUrlByStorageKey).toHaveBeenCalledWith(
        storageKey,
        'tenant-123',
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(downloadUrl);
    });

    it('should handle errors from service', async () => {
      const storageKey = 'missing-key';
      (mediaService.getDownloadUrlByStorageKey as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      const mockResponse = {
        redirect: jest.fn(),
      } as unknown as Response;

      await expect(
        controller.download(storageKey, 'tenant-123', mockResponse),
      ).rejects.toThrow('Not found');
    });
  });

  describe('getVideoEvents', () => {
    it('should return paginated video events', async () => {
      const mockEvents = {
        data: [
          { id: 'event-1', timestampMs: 1000 },
          { id: 'event-2', timestampMs: 2000 },
        ],
        total: 50,
        limit: 10,
        offset: 0,
      };
      (mediaService.getVideoEvents as jest.Mock).mockResolvedValue(mockEvents);

      const result = await controller.getVideoEvents(
        'tenant-123',
        'media-123',
        '10',
        '0',
      );

      expect(mediaService.getVideoEvents).toHaveBeenCalledWith(
        'media-123',
        'tenant-123',
        { limit: 10, offset: 0 },
      );
      expect(result).toEqual(mockEvents);
    });

    it('should use default pagination values', async () => {
      const mockEvents = {
        data: [],
        total: 0,
        limit: 100,
        offset: 0,
      };
      (mediaService.getVideoEvents as jest.Mock).mockResolvedValue(mockEvents);

      const result = await controller.getVideoEvents(
        'tenant-123',
        'media-123',
        undefined,
        undefined,
      );

      expect(mediaService.getVideoEvents).toHaveBeenCalledWith(
        'media-123',
        'tenant-123',
        { limit: 100, offset: 0 },
      );
      expect(result.limit).toBe(100);
    });

    it('should handle errors from service', async () => {
      (mediaService.getVideoEvents as jest.Mock).mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        controller.getVideoEvents('tenant-123', 'missing'),
      ).rejects.toThrow('Not found');
    });
  });

  describe('remove', () => {
    it('should delete media successfully', async () => {
      (mediaService.remove as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.remove('tenant-123', 'media-123');

      expect(mediaService.remove).toHaveBeenCalledWith('media-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });

    it('should handle errors from service', async () => {
      (mediaService.remove as jest.Mock).mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(
        controller.remove('tenant-123', 'media-123'),
      ).rejects.toThrow('Delete failed');
    });
  });
});

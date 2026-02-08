import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { S3Client } from '@aws-sdk/client-s3';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3Service', () => {
  let service: S3Service;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        's3.endpoint': 'http://localhost:9000',
        's3.accessKeyId': 'minioadmin',
        's3.secretAccessKey': 'minioadmin',
        's3.bucket': 'test-bucket',
        's3.region': 'us-east-1',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateStorageKey', () => {
    it('should generate storage key with correct format', () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const ticketId = '223e4567-e89b-12d3-a456-426614174000';
      const filename = 'test-video.mp4';

      const key = service.generateStorageKey(tenantId, ticketId, filename);

      expect(key).toMatch(
        /^123e4567-e89b-12d3-a456-426614174000\/223e4567-e89b-12d3-a456-426614174000\/[a-f0-9-]{36}\.mp4$/,
      );
    });

    it('should preserve file extension', () => {
      const key = service.generateStorageKey('tenant', 'ticket', 'file.webm');
      expect(key).toMatch(/\.webm$/);
    });

    it('should handle files without extension', () => {
      const key = service.generateStorageKey('tenant', 'ticket', 'file');
      expect(key).toMatch(/\.file$/);
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct public URL', () => {
      const key = 'tenant/ticket/file.mp4';
      const url = service.getPublicUrl(key);

      expect(url).toBe('http://localhost:9000/test-bucket/tenant/ticket/file.mp4');
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner')
        .getSignedUrl as jest.Mock;
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.com/upload');

      const result = await service.getPresignedUploadUrl(
        'test-key',
        'video/mp4',
        3600,
      );

      expect(result).toEqual({
        uploadUrl: 'https://presigned-url.com/upload',
        storageKey: 'test-key',
        expiresIn: 3600,
      });
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should use default expiry time', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner')
        .getSignedUrl as jest.Mock;
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.com/upload');

      await service.getPresignedUploadUrl('test-key', 'video/mp4');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 },
      );
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner')
        .getSignedUrl as jest.Mock;
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.com/download');

      const result = await service.getPresignedDownloadUrl('test-key', 1800);

      expect(result).toBe('https://presigned-url.com/download');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 1800 },
      );
    });
  });

  describe('objectExists', () => {
    it('should return true if object exists', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      (S3Client.prototype.send as jest.Mock) = mockSend;

      const result = await service.objectExists('existing-key');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false if object does not exist', async () => {
      const mockSend = jest.fn().mockRejectedValue({ name: 'NotFound' });
      (S3Client.prototype.send as jest.Mock) = mockSend;

      const result = await service.objectExists('non-existing-key');

      expect(result).toBe(false);
    });

    it('should throw on other errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('S3 Error'));
      (S3Client.prototype.send as jest.Mock) = mockSend;

      await expect(service.objectExists('key')).rejects.toThrow('S3 Error');
    });
  });

  describe('getObjectMetadata', () => {
    it('should return object metadata', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        ContentType: 'video/mp4',
        ContentLength: 1000000,
        LastModified: new Date(),
        Metadata: { key: 'value' },
        ETag: '"abc123"',
      });
      (S3Client.prototype.send as jest.Mock) = mockSend;

      const result = await service.getObjectMetadata('test-key');

      expect(result).toHaveProperty('contentType', 'video/mp4');
      expect(result).toHaveProperty('contentLength', 1000000);
      expect(result).toHaveProperty('etag', 'abc123');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should remove quotes from ETag', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
      });
      (S3Client.prototype.send as jest.Mock) = mockSend;

      const result = await service.getObjectMetadata('test-key');

      expect(result.etag).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });
  });

  describe('deleteObject', () => {
    it('should delete object successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      (S3Client.prototype.send as jest.Mock) = mockSend;

      await expect(service.deleteObject('test-key')).resolves.not.toThrow();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw on delete error', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Delete failed'));
      (S3Client.prototype.send as jest.Mock) = mockSend;

      await expect(service.deleteObject('test-key')).rejects.toThrow(
        'Delete failed',
      );
    });
  });
});

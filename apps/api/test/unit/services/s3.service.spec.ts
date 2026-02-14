import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../../../src/modules/media/s3.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3Service', () => {
  let service: S3Service;
  let configService: jest.Mocked<ConfigService>;
  let s3Client: jest.Mocked<S3Client>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                's3.endpoint': 'http://localhost:9000',
                's3.accessKeyId': 'minioadmin',
                's3.secretAccessKey': 'minioadmin',
                's3.bucket': 'test-bucket',
                's3.region': 'us-east-1',
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    configService = module.get(ConfigService);
    s3Client = new S3Client({}) as jest.Mocked<S3Client>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const mockUrl = 'https://s3.example.com/test-key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const result = await service.getPresignedUploadUrl(
        'test-key.mp4',
        'video/mp4',
        3600,
      );

      expect(result).toEqual({
        uploadUrl: mockUrl,
        storageKey: 'test-key.mp4',
        expiresIn: 3600,
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(PutObjectCommand),
        { expiresIn: 3600 },
      );
    });

    it('should throw error when URL generation fails', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 error'));

      await expect(
        service.getPresignedUploadUrl('test-key.mp4', 'video/mp4'),
      ).rejects.toThrow('S3 error');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const mockUrl = 'https://s3.example.com/test-key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const result = await service.getPresignedDownloadUrl('test-key.mp4', 3600);

      expect(result).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
    });

    it('should generate presigned download URL with content type', async () => {
      const mockUrl = 'https://s3.example.com/test-key?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

      const result = await service.getPresignedDownloadUrl(
        'test-key.mp4',
        3600,
        'video/mp4',
      );

      expect(result).toBe(mockUrl);
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should throw error when URL generation fails', async () => {
      (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 error'));

      await expect(service.getPresignedDownloadUrl('test-key.mp4')).rejects.toThrow(
        'S3 error',
      );
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      const result = await service.objectExists('test-key.mp4');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('should return false when object not found', async () => {
      const mockSend = jest.fn().mockRejectedValue({ name: 'NotFound' });
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      const result = await service.objectExists('missing-key.mp4');

      expect(result).toBe(false);
    });

    it('should throw error for non-NotFound errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('S3 error'));
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      await expect(service.objectExists('test-key.mp4')).rejects.toThrow(
        'S3 error',
      );
    });
  });

  describe('getObjectMetadata', () => {
    it('should return object metadata', async () => {
      const mockMetadata = {
        ContentType: 'video/mp4',
        ContentLength: 1000000,
        LastModified: new Date(),
        Metadata: { foo: 'bar' },
        ETag: '"abc123"',
      };
      const mockSend = jest.fn().mockResolvedValue(mockMetadata);
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      const result = await service.getObjectMetadata('test-key.mp4');

      expect(result).toEqual({
        contentType: 'video/mp4',
        contentLength: 1000000,
        lastModified: mockMetadata.LastModified,
        metadata: { foo: 'bar' },
        etag: 'abc123', // Quotes removed
      });
    });

    it('should throw error when metadata retrieval fails', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('S3 error'));
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      await expect(service.getObjectMetadata('test-key.mp4')).rejects.toThrow(
        'S3 error',
      );
    });
  });

  describe('deleteObject', () => {
    it('should delete object', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      await service.deleteObject('test-key.mp4');

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should throw error when delete fails', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('S3 error'));
      s3Client.send = mockSend;
      (service as any).s3Client = s3Client;

      await expect(service.deleteObject('test-key.mp4')).rejects.toThrow(
        'S3 error',
      );
    });
  });

  describe('generateStorageKey', () => {
    it('should generate storage key with correct format', () => {
      const result = service.generateStorageKey(
        'tenant-123',
        'ticket-456',
        'recording.mp4',
      );

      expect(result).toMatch(
        /^tenant-123\/ticket-456\/[a-f0-9-]{36}\.mp4$/,
      );
    });

    it('should preserve file extension', () => {
      const result = service.generateStorageKey(
        'tenant-123',
        'ticket-456',
        'screenshot.png',
      );

      expect(result).toMatch(/\.png$/);
    });
  });

  describe('getPublicUrl', () => {
    it('should generate public URL', () => {
      const result = service.getPublicUrl('tenant-123/ticket-456/file.mp4');

      expect(result).toBe(
        'http://localhost:9000/test-bucket/tenant-123/ticket-456/file.mp4',
      );
    });
  });
});

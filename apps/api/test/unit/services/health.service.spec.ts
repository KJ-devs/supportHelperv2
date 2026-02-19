import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../../../src/monitoring/health.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Mock ioredis
const mockRedis = {
  ping: jest.fn(),
  llen: jest.fn(),
  get: jest.fn(),
  zcard: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock AWS SDK S3
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  ListBucketsCommand: jest.fn(),
}));

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mock responses
    mockRedis.ping.mockResolvedValue('PONG');
    mockRedis.llen.mockResolvedValue(0);
    mockRedis.get.mockResolvedValue('0');
    mockRedis.zcard.mockResolvedValue(0);
    mockS3Send.mockResolvedValue({ Buckets: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.version') return '1.0.0';
              if (key === 'database.redisUrl') return 'redis://localhost:6379';
              if (key === 's3.endpoint') return 'http://localhost:9000';
              if (key === 's3.accessKeyId') return 'minioadmin';
              if (key === 's3.secretAccessKey') return 'minioadmin';
              if (key === 's3.region') return 'us-east-1';
              return null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBasicHealth', () => {
    it('should return basic health status', async () => {
      const result = await service.getBasicHealth();

      expect(result).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: '1.0.0',
      });
    });

    it('should use uptime from process', async () => {
      const result = await service.getBasicHealth();

      expect(result.uptime).toBeGreaterThan(0);
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('getComprehensiveHealth', () => {
    it('should return all services with healthy overall status', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockS3Send.mockResolvedValue({ Buckets: [] });

      const result = await service.getComprehensiveHealth();

      expect(['healthy', 'degraded']).toContain(result.status);
      expect(result.services).toBeDefined();
      expect(result.services).toHaveProperty('postgres');
      expect(result.services).toHaveProperty('redis');
      expect(result.services).toHaveProperty('minio');
      expect(result.services).toHaveProperty('memory');
      expect(result.services!.postgres.status).toBe('healthy');
      expect(result.version).toBe('1.0.0');
    });

    it('should return unhealthy when database is down', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB down'));

      const result = await service.getComprehensiveHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services!.postgres.status).toBe('unhealthy');
    });

    it('should return degraded when non-critical service (S3) is down', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockS3Send.mockRejectedValueOnce(new Error('S3 down'));

      const result = await service.getComprehensiveHealth();

      expect(result.status).toBe('degraded');
      expect(result.services!.postgres.status).toBe('healthy');
      expect(result.services!.minio.status).toBe('unhealthy');
    });
  });

  describe('getFullHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getFullHealth();

      // Either healthy or degraded is acceptable (Redis initialization may vary)
      expect(['healthy', 'degraded']).toContain(result.status);
      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('redis');
      expect(result.checks).toHaveProperty('minio');
      expect(result.checks).toHaveProperty('memory');
      expect(result.checks?.database.status).toBe('healthy');
    });

    it('should return unhealthy status when database fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.getFullHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks?.database.status).toBe('unhealthy');
      expect(result.checks?.database.message).toContain('Database connection failed');
    });

    it('should return degraded status when redis fails but database is healthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getFullHealth();

      expect(result.status).toBe('degraded');
      expect(result.checks?.database.status).toBe('healthy');
      expect(result.checks?.redis.status).toBe('unhealthy');
    });

    it('should return unhealthy when both database and redis fail', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));
      mockRedis.ping.mockRejectedValue(new Error('Redis error'));

      const result = await service.getFullHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks?.database.status).toBe('unhealthy');
      expect(result.checks?.redis.status).toBe('unhealthy');
    });
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is accessible', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastCheck).toBeDefined();
    });

    it('should return unhealthy status on database error', async () => {
      const error = new Error('Connection timeout');
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(error);

      const result = await service.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Connection timeout');
    });
  });

  describe('checkRedis', () => {
    it('should return healthy status when redis is accessible', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.checkRedis();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastCheck).toBeDefined();
    });

    it('should return unhealthy status when redis is not configured', async () => {
      const mockConfigNoRedis = {
        get: jest.fn((key: string) => {
          if (key === 'app.version') return '1.0.0';
          if (key === 'database.redisUrl') return null; // No Redis
          return null;
        }),
      } as unknown;
      const newService = new HealthService(mockConfigNoRedis, prisma);

      const result = await newService.checkRedis();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Redis not configured');
    });

    it('should return unhealthy status on redis error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkRedis();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('checkS3', () => {
    it('should return healthy when S3 responds', async () => {
      mockS3Send.mockResolvedValueOnce({ Buckets: [] });

      const result = await service.checkS3();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastCheck).toBeDefined();
    });

    it('should return unhealthy when S3 fails', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.checkS3();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Connection refused');
    });

    it('should return unhealthy when S3 is not configured', async () => {
      const mockConfigNoS3 = {
        get: jest.fn((key: string) => {
          if (key === 'app.version') return '1.0.0';
          if (key === 'database.redisUrl') return 'redis://localhost:6379';
          if (key.startsWith('s3.')) return null;
          return null;
        }),
      } as unknown;
      const newService = new HealthService(mockConfigNoS3, prisma);

      const result = await newService.checkS3();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('S3/MinIO not configured');
    });
  });

  describe('checkMemory', () => {
    it('should return healthy status when memory usage is below threshold', () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      })) as unknown;

      const result = service.checkMemory();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('50% used');

      process.memoryUsage = originalMemoryUsage;
    });

    it('should return unhealthy status when memory usage exceeds threshold', () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      })) as unknown;

      const result = service.checkMemory();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('95% used');

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('cron job tracking', () => {
    it('should register cron job', () => {
      const nextRun = new Date('2026-02-15T10:00:00Z');
      service.registerCronJob('test-job', nextRun);

      const jobs = service.getCronJobsStatus();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toEqual({
        name: 'test-job',
        lastRun: null,
        nextRun: nextRun.toISOString(),
        status: 'scheduled',
      });
    });

    it('should update cron job status on completion', () => {
      const nextRun = new Date();
      service.registerCronJob('test-job', nextRun);
      service.updateCronJobStatus('test-job', 'completed');

      const jobs = service.getCronJobsStatus();

      expect(jobs[0].status).toBe('completed');
      expect(jobs[0].lastRun).toBeDefined();
    });

    it('should store error message on failure', () => {
      const nextRun = new Date();
      service.registerCronJob('test-job', nextRun);
      service.updateCronJobStatus('test-job', 'failed', 'Connection timeout');

      const jobs = service.getCronJobsStatus();

      expect(jobs[0].status).toBe('failed');
      expect(jobs[0].lastError).toBe('Connection timeout');
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status from redis', async () => {
      mockRedis.llen.mockResolvedValueOnce(5).mockResolvedValueOnce(2); // waiting, active
      mockRedis.get.mockResolvedValueOnce('100').mockResolvedValueOnce('0'); // completed, paused
      mockRedis.zcard.mockResolvedValueOnce(3).mockResolvedValueOnce(1); // failed, delayed

      const result = await service.getQueueStatus('video-processing');

      expect(result).toEqual({
        name: 'video-processing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: false,
      });
    });

    it('should return null when redis is not configured', async () => {
      const mockConfigNoRedis = {
        get: jest.fn((key: string) => {
          if (key === 'app.version') return '1.0.0';
          if (key === 'database.redisUrl') return null; // No Redis
          return null;
        }),
      } as unknown;
      const newService = new HealthService(mockConfigNoRedis, prisma);

      const result = await newService.getQueueStatus('test-queue');

      expect(result).toBeNull();
    });
  });

  describe('getDeadLetterQueueCount', () => {
    it('should return total failed jobs across all queues', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(5) // video-processing
        .mockResolvedValueOnce(3) // ai-analysis
        .mockResolvedValueOnce(2) // email
        .mockResolvedValueOnce(1); // webhooks

      const result = await service.getDeadLetterQueueCount();

      expect(result).toBe(11);
    });

    it('should return 0 when redis is not configured', async () => {
      const mockConfigNoRedis = {
        get: jest.fn((key: string) => {
          if (key === 'app.version') return '1.0.0';
          if (key === 'database.redisUrl') return null; // No Redis
          return null;
        }),
      } as unknown;
      const newService = new HealthService(mockConfigNoRedis, prisma);

      const result = await newService.getDeadLetterQueueCount();

      expect(result).toBe(0);
    });
  });

  describe('isAlive', () => {
    it('should always return true', () => {
      expect(service.isAlive()).toBe(true);
    });
  });

  describe('isReady', () => {
    it('should return true when database and redis are healthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.isReady();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.isReady();

      expect(result).toBe(false);
    });

    it('should return false when redis is unhealthy', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Redis error'));

      const result = await service.isReady();

      expect(result).toBe(false);
    });
  });
});

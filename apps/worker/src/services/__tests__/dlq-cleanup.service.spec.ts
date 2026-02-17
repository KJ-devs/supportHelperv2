import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DlqCleanupService } from '../dlq-cleanup.service';
import { PrismaService } from '../prisma.service';

describe('DlqCleanupService', () => {
  let service: DlqCleanupService;
  let prisma: PrismaService;
  let dlqQueue: any;

  const mockPrisma = {
    archivedDeadLetterJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockQueue = {
    getFailed: jest.fn(),
    getFailedCount: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'DLQ_RETENTION_DAYS') return '30';
      if (key === 'DLQ_ARCHIVE_RETENTION_DAYS') return '90';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqCleanupService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DlqCleanupService>(DlqCleanupService);
    prisma = module.get<PrismaService>(PrismaService);
    dlqQueue = mockQueue;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDlqSize', () => {
    it('should return the number of failed jobs in DLQ', async () => {
      mockQueue.getFailedCount.mockResolvedValue(42);

      const size = await service.getDlqSize();

      expect(size).toBe(42);
      expect(mockQueue.getFailedCount).toHaveBeenCalled();
    });
  });

  describe('getArchiveSize', () => {
    it('should return the number of archived jobs', async () => {
      mockPrisma.archivedDeadLetterJob.count.mockResolvedValue(100);

      const size = await service.getArchiveSize();

      expect(size).toBe(100);
      expect(mockPrisma.archivedDeadLetterJob.count).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return DLQ metrics', async () => {
      const now = new Date();
      const oldestArchived = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      mockQueue.getFailedCount.mockResolvedValue(10);
      mockPrisma.archivedDeadLetterJob.count.mockResolvedValue(50);
      mockQueue.getFailed.mockResolvedValue([
        { processedOn: now.getTime() - 7 * 24 * 60 * 60 * 1000 }, // 7 days ago
      ]);
      mockPrisma.archivedDeadLetterJob.findFirst.mockResolvedValue({
        archivedAt: oldestArchived,
      });

      const metrics = await service.getMetrics();

      expect(metrics.dlqSize).toBe(10);
      expect(metrics.archiveSize).toBe(50);
      expect(metrics.retentionDays).toBe(30);
      expect(metrics.archiveRetentionDays).toBe(90);
      expect(metrics.oldestDlqJob).toBeInstanceOf(Date);
      expect(metrics.oldestArchivedJob).toEqual(oldestArchived);
    });

    it('should handle empty DLQ', async () => {
      mockQueue.getFailedCount.mockResolvedValue(0);
      mockPrisma.archivedDeadLetterJob.count.mockResolvedValue(0);
      mockQueue.getFailed.mockResolvedValue([]);
      mockPrisma.archivedDeadLetterJob.findFirst.mockResolvedValue(null);

      const metrics = await service.getMetrics();

      expect(metrics.dlqSize).toBe(0);
      expect(metrics.archiveSize).toBe(0);
      expect(metrics.oldestDlqJob).toBeNull();
      expect(metrics.oldestArchivedJob).toBeNull();
    });
  });

  describe('runCleanup', () => {
    it('should run full cleanup workflow', async () => {
      const now = Date.now();
      const oldJobTime = now - 35 * 24 * 60 * 60 * 1000; // 35 days ago

      // Mock old jobs in DLQ
      mockQueue.getFailed.mockResolvedValue([
        {
          id: 'job-1',
          queueName: 'video-analysis',
          name: 'analyze',
          data: { tenantId: 'tenant-1', ticketId: 'ticket-1' },
          processedOn: oldJobTime,
          failedReason: 'Network error',
          stacktrace: ['Error: Network error'],
          attemptsMade: 3,
          remove: jest.fn(),
        },
      ]);

      mockQueue.getFailedCount.mockResolvedValue(5);
      mockPrisma.archivedDeadLetterJob.create.mockResolvedValue({});
      mockPrisma.archivedDeadLetterJob.findFirst.mockResolvedValue({ id: 'archived-1' });
      mockPrisma.archivedDeadLetterJob.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.archivedDeadLetterJob.count.mockResolvedValue(10);

      const result = await service.runCleanup();

      expect(result).toHaveProperty('archived');
      expect(result).toHaveProperty('deletedFromDlq');
      expect(result).toHaveProperty('deletedFromArchive');
      expect(result).toHaveProperty('dlqSize', 5);
      expect(result).toHaveProperty('archiveSize', 10);
    });
  });

  describe('retryArchivedJob', () => {
    it('should throw error when job not found', async () => {
      mockPrisma.archivedDeadLetterJob.findUnique.mockResolvedValue(null);

      await expect(service.retryArchivedJob('non-existent')).rejects.toThrow(
        'Archived job non-existent not found',
      );
    });

    it('should throw not implemented error for now', async () => {
      mockPrisma.archivedDeadLetterJob.findUnique.mockResolvedValue({
        id: 'archived-1',
        queueName: 'video-analysis',
        jobData: {},
      });

      await expect(service.retryArchivedJob('archived-1')).rejects.toThrow(
        'Manual retry not yet implemented',
      );
    });
  });
});

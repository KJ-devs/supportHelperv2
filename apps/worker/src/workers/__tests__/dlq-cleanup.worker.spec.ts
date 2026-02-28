import { Test, TestingModule } from '@nestjs/testing';
import { DlqCleanupWorker } from '../dlq-cleanup.worker';
import { DlqCleanupService } from '../../services/dlq-cleanup.service';
import { Job } from 'bullmq';

describe('DlqCleanupWorker', () => {
  let worker: DlqCleanupWorker;

  const mockDlqCleanupService = {
    runCleanup: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqCleanupWorker,
        {
          provide: DlqCleanupService,
          useValue: mockDlqCleanupService,
        },
      ],
    }).compile();

    worker = module.get<DlqCleanupWorker>(DlqCleanupWorker);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should run cleanup successfully', async () => {
      const mockJob = {
        id: 'cleanup-1',
        data: { triggeredBy: 'cron' },
      } as Job;

      const cleanupResult = {
        archived: 10,
        deletedFromDlq: 10,
        deletedFromArchive: 5,
        dlqSize: 20,
        archiveSize: 50,
      };

      mockDlqCleanupService.runCleanup.mockResolvedValue(cleanupResult);

      const result = await worker.process(mockJob);

      expect(result.success).toBe(true);
      expect(result.archived).toBe(10);
      expect(result.deletedFromDlq).toBe(10);
      expect(result.deletedFromArchive).toBe(5);
      expect(result.dlqSize).toBe(20);
      expect(result.archiveSize).toBe(50);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockDlqCleanupService.runCleanup).toHaveBeenCalled();
    });

    it('should handle cleanup failure gracefully', async () => {
      const mockJob = {
        id: 'cleanup-2',
        data: { triggeredBy: 'manual' },
      } as Job;

      mockDlqCleanupService.runCleanup.mockRejectedValue(new Error('Redis connection failed'));

      const result = await worker.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis connection failed');
      expect(result.archived).toBe(0);
      expect(result.deletedFromDlq).toBe(0);
      expect(result.deletedFromArchive).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

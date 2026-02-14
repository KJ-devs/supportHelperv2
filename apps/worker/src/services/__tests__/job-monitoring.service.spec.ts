import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JobMonitoringService } from '../job-monitoring.service';
import { QUEUE_NAMES } from '../../queues';

describe('JobMonitoringService', () => {
  let service: JobMonitoringService;
  let mockVideoQueue: any;
  let mockGithubQueue: any;
  let mockAgentQueue: any;
  let mockIntegrationQueue: any;
  let mockDeadLetterQueue: any;

  beforeEach(async () => {
    // Mock queue instances
    const createMockQueue = (name: string) => ({
      name,
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 1,
        paused: 0,
      }),
      getCompleted: jest.fn().mockResolvedValue([
        {
          finishedOn: Date.now(),
          processedOn: Date.now() - 5000,
          data: { test: true },
        },
        {
          finishedOn: Date.now(),
          processedOn: Date.now() - 3000,
          data: { test: true },
        },
      ]),
      getWaiting: jest.fn().mockResolvedValue([
        {
          id: '1',
          timestamp: Date.now() - 60000,
          data: { test: true },
        },
      ]),
      getFailed: jest.fn().mockResolvedValue([
        {
          id: 'failed-1',
          remove: jest.fn().mockResolvedValue(true),
          retry: jest.fn().mockResolvedValue(true),
        },
        {
          id: 'failed-2',
          remove: jest.fn().mockResolvedValue(true),
          retry: jest.fn().mockResolvedValue(true),
        },
      ]),
    });

    mockVideoQueue = createMockQueue(QUEUE_NAMES.VIDEO_ANALYSIS);
    mockGithubQueue = createMockQueue(QUEUE_NAMES.GITHUB_SYNC);
    mockAgentQueue = createMockQueue(QUEUE_NAMES.AGENT_ORCHESTRATION);
    mockIntegrationQueue = createMockQueue(QUEUE_NAMES.INTEGRATION_SYNC);
    mockDeadLetterQueue = createMockQueue('dead-letter');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMonitoringService,
        {
          provide: getQueueToken(QUEUE_NAMES.VIDEO_ANALYSIS),
          useValue: mockVideoQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.GITHUB_SYNC),
          useValue: mockGithubQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.AGENT_ORCHESTRATION),
          useValue: mockAgentQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.INTEGRATION_SYNC),
          useValue: mockIntegrationQueue,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    service = module.get<JobMonitoringService>(JobMonitoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSystemStats', () => {
    it('should return statistics for all queues', async () => {
      const stats = await service.getSystemStats();

      expect(stats).toBeDefined();
      expect(stats.queues).toHaveLength(4);
      expect(stats.deadLetterQueue).toBeDefined();
      expect(stats.summary).toBeDefined();
      expect(stats.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate summary correctly', async () => {
      const stats = await service.getSystemStats();

      // 4 queues x 10 waiting = 40
      expect(stats.summary.totalWaiting).toBe(40);
      // 4 queues x 2 active = 8
      expect(stats.summary.totalActive).toBe(8);
      // 4 queues x 5 failed = 20
      expect(stats.summary.totalFailed).toBe(20);
    });

    it('should calculate failure rate correctly', async () => {
      const stats = await service.getSystemStats();

      // Failure rate = failed / (completed + failed)
      // Per queue: 5 / (100 + 5) = 4.76%
      // Overall: 20 / (400 + 20) = 4.76%
      expect(stats.summary.overallFailureRate).toBeCloseTo(4.76, 1);
    });
  });

  describe('getQueueStats', () => {
    it('should return stats for a specific queue', async () => {
      const stats = await service.getQueueStats(mockVideoQueue);

      expect(stats.queueName).toBe(QUEUE_NAMES.VIDEO_ANALYSIS);
      expect(stats.counts).toBeDefined();
      expect(stats.counts.waiting).toBe(10);
      expect(stats.counts.active).toBe(2);
      expect(stats.counts.completed).toBe(100);
      expect(stats.counts.failed).toBe(5);
    });

    it('should calculate average processing time', async () => {
      const stats = await service.getQueueStats(mockVideoQueue);

      expect(stats.metrics.avgProcessingTime).toBeDefined();
      // Average of 5000ms and 3000ms = 4000ms
      expect(stats.metrics.avgProcessingTime).toBe(4000);
    });

    it('should identify oldest waiting job', async () => {
      const stats = await service.getQueueStats(mockVideoQueue);

      expect(stats.metrics.oldestWaitingJob).toBeDefined();
      expect(stats.metrics.oldestWaitingJob).toBeInstanceOf(Date);
    });

    it('should calculate failure rate', async () => {
      const stats = await service.getQueueStats(mockVideoQueue);

      expect(stats.metrics.failureRate).toBeDefined();
      // 5 / (100 + 5) = 4.76%
      expect(stats.metrics.failureRate).toBeCloseTo(4.76, 1);
    });
  });

  describe('getQueueStatsByName', () => {
    it('should return stats for valid queue name', async () => {
      const stats = await service.getQueueStatsByName(QUEUE_NAMES.VIDEO_ANALYSIS);

      expect(stats).toBeDefined();
      expect(stats?.queueName).toBe(QUEUE_NAMES.VIDEO_ANALYSIS);
    });

    it('should return null for invalid queue name', async () => {
      const stats = await service.getQueueStatsByName('invalid-queue');

      expect(stats).toBeNull();
    });

    it('should return dead letter queue stats', async () => {
      const stats = await service.getQueueStatsByName('dead-letter');

      expect(stats).toBeDefined();
      expect(stats?.queueName).toBe('dead-letter');
    });
  });

  describe('clearFailedJobs', () => {
    it('should clear all failed jobs from a queue', async () => {
      const count = await service.clearFailedJobs(QUEUE_NAMES.VIDEO_ANALYSIS);

      expect(count).toBe(2);
      expect(mockVideoQueue.getFailed).toHaveBeenCalledWith(0, -1);
    });

    it('should throw error for invalid queue name', async () => {
      await expect(service.clearFailedJobs('invalid-queue')).rejects.toThrow(
        'Queue invalid-queue not found',
      );
    });
  });

  describe('retryFailedJobs', () => {
    it('should retry all failed jobs in a queue', async () => {
      const count = await service.retryFailedJobs(QUEUE_NAMES.VIDEO_ANALYSIS);

      expect(count).toBe(2);
      expect(mockVideoQueue.getFailed).toHaveBeenCalledWith(0, -1);
    });

    it('should throw error for invalid queue name', async () => {
      await expect(service.retryFailedJobs('invalid-queue')).rejects.toThrow(
        'Queue invalid-queue not found',
      );
    });
  });
});

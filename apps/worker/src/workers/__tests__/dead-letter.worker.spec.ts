import { Test, TestingModule } from '@nestjs/testing';
import { DeadLetterWorker } from '../dead-letter.worker';
import { PrismaService } from '../../services/prisma.service';
import { Job } from 'bullmq';

describe('DeadLetterWorker', () => {
  let worker: DeadLetterWorker;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterWorker,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    worker = module.get<DeadLetterWorker>(DeadLetterWorker);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should log failed job details', async () => {
      const mockJob = {
        id: 'test-job-123',
        queueName: 'video-analysis',
        data: {
          ticketId: 'ticket-123',
          tenantId: 'tenant-123',
          mediaId: 'media-123',
        },
        failedReason: 'FFmpeg extraction failed',
        attemptsMade: 4,
        stacktrace: ['Error: FFmpeg extraction failed', '  at process'],
      } as unknown as Job;

      await worker.process(mockJob);

      // Should complete without throwing
      // Note: Database update has been removed from implementation
      expect(prismaService.ticket.update).not.toHaveBeenCalled();
    });

    it('should handle jobs without ticketId', async () => {
      const mockJob = {
        id: 'test-job-456',
        queueName: 'github-sync',
        data: {
          tenantId: 'tenant-123',
          type: 'sync-repository',
        },
        failedReason: 'GitHub API rate limit',
        attemptsMade: 4,
        stacktrace: [],
      } as unknown as Job;

      await worker.process(mockJob);

      // Should not attempt to update ticket
      expect(prismaService.ticket.update).not.toHaveBeenCalled();
    });

    it('should not throw if ticket update fails', async () => {
      const mockJob = {
        id: 'test-job-789',
        queueName: 'video-analysis',
        data: {
          ticketId: 'nonexistent-ticket',
          tenantId: 'tenant-123',
        },
        failedReason: 'Test error',
        attemptsMade: 4,
        stacktrace: [],
      } as unknown as Job;

      // Simulate ticket update failure
      (prismaService.ticket.update as jest.Mock).mockRejectedValueOnce(
        new Error('Ticket not found'),
      );

      // Should complete without throwing
      await expect(worker.process(mockJob)).resolves.toBeUndefined();
    });

    it('should identify critical failures', async () => {
      const criticalJob = {
        id: 'critical-job',
        queueName: 'agent-orchestration',
        data: {
          ticketId: 'ticket-123',
          tenantId: 'tenant-123',
          type: 'start-session',
        },
        failedReason: 'OpenAI API error',
        attemptsMade: 5,
        stacktrace: [],
      } as unknown as Job;

      const logSpy = jest.spyOn(worker['logger'], 'warn');

      await worker.process(criticalJob);

      // Should log critical warning
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL FAILURE'),
      );
    });

    it('should not mark non-critical queues as critical', async () => {
      const normalJob = {
        id: 'normal-job',
        queueName: 'github-sync',
        data: {
          tenantId: 'tenant-123',
        },
        failedReason: 'Network timeout',
        attemptsMade: 4,
        stacktrace: [],
      } as unknown as Job;

      const logSpy = jest.spyOn(worker['logger'], 'warn');

      await worker.process(normalJob);

      // Should not log critical warning
      const criticalCalls = logSpy.mock.calls.filter((call) =>
        call[0]?.includes('CRITICAL FAILURE'),
      );
      expect(criticalCalls).toHaveLength(0);
    });
  });
});

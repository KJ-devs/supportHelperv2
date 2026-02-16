import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GithubWebhookProcessor, GithubWebhookJobData } from '../../../src/modules/github/processors/github-webhook.processor';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { GithubIssuesService } from '../../../src/modules/github/services/github-issues.service';
import { CodebaseIndexerService } from '../../../src/modules/codebase-index/services/codebase-indexer.service';
import { CIFeedbackService } from '../../../src/modules/agent-tasks/services/ci-feedback.service';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

describe('GithubWebhookProcessor', () => {
  let processor: GithubWebhookProcessor;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    $executeRaw: jest.fn(),
    githubIssue: { findFirst: jest.fn() },
    projectGithubConfig: { deleteMany: jest.fn() },
  };

  const mockIssuesService = {
    autoCreateIssueFromTicket: jest.fn(),
    syncTicketStatusToGithub: jest.fn(),
  };

  const mockCodebaseIndexer = {
    queueIncrementalIndex: jest.fn(),
  };

  const mockCIFeedbackService = {
    handleCIFailure: jest.fn().mockResolvedValue({ handled: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubWebhookProcessor,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: GithubIssuesService,
          useValue: mockIssuesService,
        },
        {
          provide: CodebaseIndexerService,
          useValue: mockCodebaseIndexer,
        },
        {
          provide: CIFeedbackService,
          useValue: mockCIFeedbackService,
        },
      ],
    }).compile();

    processor = module.get<GithubWebhookProcessor>(GithubWebhookProcessor);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should process issue event', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'issues',
        eventData: { action: 'opened' },
        payload: {
          action: 'opened',
          issue: { number: 42, title: 'Test issue' },
          repository: { full_name: 'owner/repo' },
        },
        deliveryId: 'delivery-123',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-123' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: true,
        action: 'opened',
        issueNumber: 42,
        repository: 'owner/repo',
      });
    });

    it('should process pull_request event', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'pull_request',
        eventData: { action: 'synchronize' },
        payload: {
          action: 'synchronize',
          pull_request: { number: 15, title: 'Add feature' },
          repository: { full_name: 'owner/repo' },
        },
        deliveryId: 'delivery-456',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-456' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: true,
        action: 'synchronize',
        prNumber: 15,
        repository: 'owner/repo',
      });
    });

    it('should process push event with commits', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'push',
        eventData: {},
        payload: {
          repository: { full_name: 'owner/repo' },
          ref: 'refs/heads/main',
          commits: [
            { id: 'abc123', message: 'Commit 1' },
            { id: 'def456', message: 'Commit 2' },
          ],
        },
        deliveryId: 'delivery-789',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-789' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: true,
        repository: 'owner/repo',
        ref: 'refs/heads/main',
        commitCount: 2,
      });
    });

    it('should process push event without commits', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'push',
        eventData: {},
        payload: {
          repository: { full_name: 'owner/repo' },
          ref: 'refs/heads/feature',
          commits: null,
        },
        deliveryId: 'delivery-000',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-000' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: true,
        repository: 'owner/repo',
        ref: 'refs/heads/feature',
        commitCount: 0,
      });
    });

    it('should process issue_comment event', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'issue_comment',
        eventData: { action: 'created' },
        payload: {
          action: 'created',
          issue: { number: 10 },
          comment: { id: 999, body: 'Nice work!' },
          repository: { full_name: 'owner/repo' },
        },
        deliveryId: 'delivery-abc',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-abc' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: true,
        action: 'created',
        issueNumber: 10,
        repository: 'owner/repo',
      });
    });

    it('should return unhandled for unknown event type', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'unknown_event',
        eventData: {},
        payload: {},
        deliveryId: 'delivery-xyz',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-xyz' } as Job<GithubWebhookJobData>;

      const result = await processor.process(job);

      expect(result).toEqual({
        handled: false,
        event: 'unknown_event',
      });
    });

    it('should log unhandled event types as debug', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      const jobData: GithubWebhookJobData = {
        event: 'ping',
        eventData: {},
        payload: {},
        deliveryId: 'delivery-ping',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-ping' } as Job<GithubWebhookJobData>;

      await processor.process(job);

      expect(debugSpy).toHaveBeenCalledWith('Unhandled event type: ping');
    });

    it('should throw error on processing failure', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'issues',
        eventData: { action: 'opened' },
        payload: null as any, // Invalid payload will cause error
        deliveryId: 'delivery-error',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-error' } as Job<GithubWebhookJobData>;

      await expect(processor.process(job)).rejects.toThrow();
    });

    it('should rethrow errors during processing', async () => {
      const jobData: GithubWebhookJobData = {
        event: 'issues',
        eventData: { action: 'opened' },
        payload: null as any, // This will cause an error
        deliveryId: 'delivery-error',
        receivedAt: new Date().toISOString(),
      };

      const job = { data: jobData, id: 'job-error' } as Job<GithubWebhookJobData>;

      // Should throw error after logging
      await expect(processor.process(job)).rejects.toThrow();
    });
  });

  describe('onCompleted', () => {
    it('should log completion event', () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      const jobData: GithubWebhookJobData = {
        event: 'issues',
        eventData: {},
        payload: {},
        deliveryId: 'delivery-complete',
        receivedAt: new Date().toISOString(),
      };

      const job = { id: 'job-complete', data: jobData } as Job<GithubWebhookJobData>;

      processor.onCompleted(job);

      expect(debugSpy).toHaveBeenCalledWith(
        'Job job-complete completed for event: issues'
      );
    });
  });

  describe('onFailed', () => {
    it('should log failure event with error stack', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const jobData: GithubWebhookJobData = {
        event: 'push',
        eventData: {},
        payload: {},
        deliveryId: 'delivery-fail',
        receivedAt: new Date().toISOString(),
      };

      const job = { id: 'job-fail', data: jobData } as Job<GithubWebhookJobData>;
      const error = new Error('Processing failed');

      processor.onFailed(job, error);

      expect(errorSpy).toHaveBeenCalledWith(
        'Job job-fail failed for event: push',
        error.stack
      );
    });
  });
});

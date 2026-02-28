// Mock @octokit/rest before any imports — it is an ESM module that ts-jest cannot parse
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    issues: {
      listForRepo: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
      createComment: jest.fn(),
      listComments: jest.fn(),
    },
    repos: { get: jest.fn() },
    users: { getAuthenticated: jest.fn() },
    search: { issuesAndPullRequests: jest.fn() },
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { GithubSyncWorker } from '../github-sync.worker';
import { GithubService } from '../../services/github.service';
import { PrismaService } from '../../services/prisma.service';
import {
  GithubSyncJobData,
  GithubCreateIssuePayload,
  GithubUpdateIssuePayload,
  GithubSyncIssuesPayload,
  GithubWebhookPayload,
  GithubSyncRepoPayload,
} from '../../queues/queue.types';
import { QUEUE_NAMES } from '../../queues';

describe('GithubSyncWorker', () => {
  let worker: GithubSyncWorker;
  let githubService: jest.Mocked<GithubService>;
  let prisma: jest.Mocked<PrismaService>;
  let deadLetterQueue: jest.Mocked<Queue>;

  // ─── Fixtures ───────────────────────────────────────────────────────────────

  const mockConnection = {
    id: 'conn-1',
    tenantId: 'tenant-1',
    installationId: BigInt(12345),
    accessToken: 'ghs_validtoken123',
    refreshToken: null,
    tokenExpiresAt: null,
  };

  const mockTicket = {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    applicationId: 'app-1',
    title: 'Login page crashes on submit',
    description: 'Clicking submit button results in white screen',
    status: 'open',
    severity: 'high',
    type: 'bug',
    aiSummary: 'User reports crash on login form submission',
    reproductionSteps: ['Navigate to /login', 'Fill in credentials', 'Click submit'],
    userContext: { browser: 'Chrome 121', os: 'macOS 14' },
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    media: [],
    application: { id: 'app-1', name: 'Test App', tenantId: 'tenant-1' },
  };

  const mockCreatedIssue = {
    number: 42,
    html_url: 'https://github.com/owner/repo/issues/42',
    state: 'open',
    title: 'Login page crashes on submit',
  };

  const mockJob = (
    data: GithubSyncJobData,
    attemptsMade = 0,
    opts: { attempts?: number } = { attempts: 4 },
  ): Job<GithubSyncJobData> =>
    ({
      id: 'job-github-1',
      data,
      attemptsMade,
      opts,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as unknown as Job<GithubSyncJobData>;

  // ─── Module Setup ────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const mockGithubService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      listIssues: jest.fn().mockResolvedValue([]),
      createIssue: jest.fn().mockResolvedValue(mockCreatedIssue),
      updateIssue: jest.fn().mockResolvedValue({ ...mockCreatedIssue, state: 'closed' }),
      getIssue: jest.fn(),
      addComment: jest.fn(),
    };

    const mockPrisma = {
      githubConnection: {
        findUnique: jest.fn(),
      },
      ticket: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      githubIssue: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mockDeadLetterQueue = {
      add: jest.fn().mockResolvedValue({ id: 'dlq-job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubSyncWorker,
        {
          provide: GithubService,
          useValue: mockGithubService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    worker = module.get<GithubSyncWorker>(GithubSyncWorker);
    githubService = module.get(GithubService);
    prisma = module.get(PrismaService);
    deadLetterQueue = module.get(getQueueToken('dead-letter'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── AC1: Ticket sync → creates GitHub issue via API ─────────────────────────

  describe('AC1 - create-issue: creates GitHub issue and returns success', () => {
    it('should create a GitHub issue and persist the link with status success', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({
        id: 'github-issue-link-1',
        ticketId: 'ticket-1',
        githubRepo: 'owner/repo',
        githubIssueNumber: 42,
      });

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Login page crashes on submit',
        body: 'Steps to reproduce...',
        labels: ['bug', 'high-priority'],
      };

      const job = mockJob({
        type: 'create-issue',
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
        payload,
      });

      const result = await worker.process(job);

      // Verify GitHub connection was fetched
      expect(prisma.githubConnection.findUnique).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
      });

      // Verify GitHub client was initialized with connection credentials
      expect(githubService.initialize).toHaveBeenCalledWith(mockConnection);

      // Verify issue was created on GitHub
      expect(githubService.createIssue).toHaveBeenCalledWith(
        'owner/repo',
        expect.objectContaining({
          title: 'Login page crashes on submit',
          body: expect.stringContaining('Steps to reproduce'),
          labels: ['bug', 'high-priority'],
        }),
      );

      // Verify link was stored in database
      expect(prisma.githubIssue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket-1',
          githubRepo: 'owner/repo',
          githubIssueNumber: 42,
          githubIssueUrl: 'https://github.com/owner/repo/issues/42',
          syncStatus: 'open',
          lastSyncedAt: expect.any(Date),
        }),
      });

      // Verify successful result
      expect(result).toEqual({
        success: true,
        type: 'create-issue',
        issueNumber: 42,
      });
    });

    it('should include AI summary in issue body when ticket has aiSummary', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({});

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: mockTicket.title,
        body: 'Initial body',
      };

      await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      const createCallArgs = (githubService.createIssue as jest.Mock).mock.calls[0]![1];
      expect(createCallArgs.body).toContain('AI Analysis');
      expect(createCallArgs.body).toContain(mockTicket.aiSummary);
    });

    it('should include user context environment in issue body', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({});

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: mockTicket.title,
        body: 'Initial body',
      };

      await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      const createCallArgs = (githubService.createIssue as jest.Mock).mock.calls[0]![1];
      expect(createCallArgs.body).toContain('Environment');
      expect(createCallArgs.body).toContain('Chrome 121');
    });

    it('should auto-generate labels from ticket type and severity when none provided', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({});

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: mockTicket.title,
        body: 'Body',
        // No labels provided
      };

      await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      const createCallArgs = (githubService.createIssue as jest.Mock).mock.calls[0]![1];
      expect(createCallArgs.labels).toContain('type:bug');
      expect(createCallArgs.labels).toContain('severity:high');
      expect(createCallArgs.labels).toContain('support-helper');
    });

    it('should throw and return failure when ticket not found', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-missing',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob({
          type: 'create-issue',
          tenantId: 'tenant-1',
          connectionId: 'conn-1',
          payload,
        }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ticket ticket-missing not found');
      expect(githubService.createIssue).not.toHaveBeenCalled();
    });
  });

  // ─── AC2: Invalid/expired credentials ────────────────────────────────────────

  describe('AC2 - invalid/expired credentials → sync fail', () => {
    it('should return failure result when GitHub token is expired (401)', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

      const authError = new Error('Bad credentials');
      Object.assign(authError, { status: 401 });
      githubService.createIssue.mockRejectedValue(authError);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad credentials');
    });

    it('should return failure result when GitHub connection not found', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(null);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-missing', payload }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub connection conn-missing not found');
      expect(githubService.initialize).not.toHaveBeenCalled();
    });

    it('should return failure result when GitHub token is revoked (403 forbidden)', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

      const forbiddenError = new Error('Resource not accessible by integration');
      Object.assign(forbiddenError, { status: 403 });
      githubService.createIssue.mockRejectedValue(forbiddenError);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resource not accessible by integration');
    });
  });

  // ─── AC3: GitHub API rate limit (429) → retry with backoff ───────────────────

  describe('AC3 - GitHub API rate limit 429 → retry with backoff', () => {
    it('should return failure result when GitHub returns 429 rate limit', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

      const rateLimitError = new Error('API rate limit exceeded');
      Object.assign(rateLimitError, { status: 429 });
      githubService.createIssue.mockRejectedValue(rateLimitError);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob(
          { type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload },
          0,
          { attempts: 4 },
        ),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
    });

    it('should return failure result on secondary rate limit (403 with specific message)', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

      const secondaryRateLimit = new Error('You have exceeded a secondary rate limit');
      Object.assign(secondaryRateLimit, { status: 403 });
      githubService.createIssue.mockRejectedValue(secondaryRateLimit);

      const payload: GithubCreateIssuePayload = {
        ticketId: 'ticket-1',
        repo: 'owner/repo',
        title: 'Title',
        body: 'Body',
      };

      const result = await worker.process(
        mockJob({ type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('secondary rate limit');
    });

    it('getNextRetryDelay returns exponential backoff delays [1min, 5min, 15min, 1hr]', async () => {
      // Access private method via cast
      const w = worker as unknown as {
        getNextRetryDelay: (attemptsMade: number) => number;
      };

      expect(w.getNextRetryDelay(0)).toBe(60 * 1000);       // 1 min
      expect(w.getNextRetryDelay(1)).toBe(5 * 60 * 1000);   // 5 min
      expect(w.getNextRetryDelay(2)).toBe(15 * 60 * 1000);  // 15 min
      expect(w.getNextRetryDelay(3)).toBe(60 * 60 * 1000);  // 1 hr
      expect(w.getNextRetryDelay(10)).toBe(60 * 60 * 1000); // capped at 1 hr
    });
  });

  // ─── AC4: Sync log transitions via worker events ──────────────────────────────

  describe('AC4 - sync log state transitions via worker events', () => {
    it('onActive logs job start with attempt count', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log').mockImplementation(() => undefined);

      const job = mockJob(
        { type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload: {} as any },
        1,
        { attempts: 4 },
      );

      worker.onActive(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('job-github-1'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('2/4'), // attempt 1+1=2 out of 4
      );
    });

    it('onCompleted logs success with item count', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log').mockImplementation(() => undefined);

      const job = mockJob(
        { type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload: {} as any },
      );

      const result = { success: true, type: 'create-issue' as const, issueNumber: 42 };
      worker.onCompleted(job, result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('job-github-1'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('create-issue'),
      );
    });

    it('onFailed with non-final attempt logs warning (no DLQ)', async () => {
      const warnSpy = jest.spyOn(worker['logger'], 'warn').mockImplementation(() => undefined);
      jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      const job = mockJob(
        { type: 'create-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload: {} as any },
        1,   // attemptsMade = 1, maxAttempts = 4 → not final
        { attempts: 4 },
      );

      await worker.onFailed(job, new Error('Transient error'));

      expect(deadLetterQueue.add).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('retry'),
      );
    });

    it('onFailed with max attempts moves job to dead letter queue', async () => {
      jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      const job = mockJob(
        {
          type: 'create-issue',
          tenantId: 'tenant-1',
          connectionId: 'conn-1',
          payload: {
            ticketId: 'ticket-1',
            repo: 'owner/repo',
            title: 'Title',
            body: 'Body',
          } as GithubCreateIssuePayload,
        },
        4,   // attemptsMade = 4 = maxAttempts
        { attempts: 4 },
      );

      const error = new Error('GitHub unreachable after 4 attempts');
      await worker.onFailed(job, error);

      expect(deadLetterQueue.add).toHaveBeenCalledWith(
        'failed-github-sync',
        expect.objectContaining({
          originalJobId: 'job-github-1',
          queueName: QUEUE_NAMES.GITHUB_SYNC,
          jobData: job.data,
          failedReason: 'GitHub unreachable after 4 attempts',
          attemptsMade: 4,
          timestamp: expect.any(String),
        }),
        expect.objectContaining({
          removeOnComplete: { age: 90 * 24 * 60 * 60 },
        }),
      );
    });

    it('onFailed without job context logs error but does not crash', async () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      await worker.onFailed(undefined, new Error('No job context'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No job context'),
      );
      expect(deadLetterQueue.add).not.toHaveBeenCalled();
    });
  });

  // ─── update-issue flow ────────────────────────────────────────────────────────

  describe('update-issue: updates GitHub issue and syncs local state', () => {
    it('should update GitHub issue and update local sync status', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.githubIssue.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const payload: GithubUpdateIssuePayload = {
        ticketId: 'ticket-1',
        issueNumber: 42,
        repo: 'owner/repo',
        updates: { state: 'closed', title: 'Updated title' },
      };

      const result = await worker.process(
        mockJob({ type: 'update-issue', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(githubService.updateIssue).toHaveBeenCalledWith('owner/repo', 42, {
        state: 'closed',
        title: 'Updated title',
      });

      expect(prisma.githubIssue.updateMany).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1', githubRepo: 'owner/repo', githubIssueNumber: 42 },
        data: expect.objectContaining({
          syncStatus: 'closed',
          lastSyncedAt: expect.any(Date),
        }),
      });

      expect(result).toEqual({
        success: true,
        type: 'update-issue',
        issueNumber: 42,
      });
    });
  });

  // ─── sync-issues flow ─────────────────────────────────────────────────────────

  describe('sync-issues: syncs GitHub issues to local database', () => {
    it('should list issues and update existing links', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const remoteIssues = [
        { number: 10, title: 'Bug A', state: 'open', html_url: 'https://github.com/owner/repo/issues/10' },
        { number: 11, title: 'Bug B', state: 'closed', html_url: 'https://github.com/owner/repo/issues/11' },
      ];
      githubService.listIssues.mockResolvedValue(remoteIssues);

      const existingLink = { id: 'link-1', ticketId: 'ticket-1', githubIssueNumber: 10 };
      (prisma.githubIssue.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingLink)  // issue 10: exists
        .mockResolvedValueOnce(null);          // issue 11: new

      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      const payload: GithubSyncIssuesPayload = {
        repo: 'owner/repo',
        state: 'all',
      };

      const result = await worker.process(
        mockJob({ type: 'sync-issues', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(githubService.listIssues).toHaveBeenCalledWith('owner/repo', {
        state: 'all',
        since: undefined,
        per_page: 100,
      });

      // Existing link should be updated
      expect(prisma.githubIssue.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: expect.objectContaining({
          syncStatus: 'open',
          lastSyncedAt: expect.any(Date),
        }),
      });

      expect(result).toEqual({
        success: true,
        type: 'sync-issues',
        itemsProcessed: 2,
      });
    });

    it('should return 0 items processed when no issues exist', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      githubService.listIssues.mockResolvedValue([]);

      const payload: GithubSyncIssuesPayload = { repo: 'owner/empty-repo' };

      const result = await worker.process(
        mockJob({ type: 'sync-issues', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result).toEqual({
        success: true,
        type: 'sync-issues',
        itemsProcessed: 0,
      });
    });
  });

  // ─── webhook-event flow ───────────────────────────────────────────────────────

  describe('webhook-event: processes GitHub webhook events', () => {
    it('should update ticket status to resolved on issues.closed event', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const issueLink = {
        id: 'link-1',
        ticketId: 'ticket-1',
        ticket: mockTicket,
      };
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(issueLink);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'resolved' });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      const payload: GithubWebhookPayload = {
        event: 'issues',
        action: 'closed',
        data: {
          issue: { number: 42, state: 'closed', title: 'Bug' },
          repository: { full_name: 'owner/repo' },
        },
      };

      const result = await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
        }),
      });

      expect(prisma.githubIssue.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: expect.objectContaining({
          syncStatus: 'closed',
          lastSyncedAt: expect.any(Date),
        }),
      });

      expect(result).toEqual({
        success: true,
        type: 'webhook-event',
        itemsProcessed: 1,
      });
    });

    it('should update ticket status to open on issues.reopened event', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const issueLink = { id: 'link-1', ticketId: 'ticket-1', ticket: mockTicket };
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(issueLink);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      const payload: GithubWebhookPayload = {
        event: 'issues',
        action: 'reopened',
        data: {
          issue: { number: 42, state: 'open' },
          repository: { full_name: 'owner/repo' },
        },
      };

      await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          status: 'open',
          resolvedAt: null,
        }),
      });
    });

    it('should return 0 processed when webhook issue has no local link', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      const payload: GithubWebhookPayload = {
        event: 'issues',
        action: 'closed',
        data: {
          issue: { number: 99, state: 'closed' },
          repository: { full_name: 'owner/repo' },
        },
      };

      const result = await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        type: 'webhook-event',
        itemsProcessed: 0,
      });
    });

    it('should process issue_comment events without error', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const payload: GithubWebhookPayload = {
        event: 'issue_comment',
        action: 'created',
        data: {
          issue: { number: 42 },
          comment: { body: 'Looks fixed!' },
        },
      };

      const result = await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('webhook-event');
    });

    it('should process pull_request events without error', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const payload: GithubWebhookPayload = {
        event: 'pull_request',
        action: 'merged',
        data: {
          pull_request: { number: 7, title: 'Fix login crash', state: 'closed' },
        },
      };

      const result = await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(true);
    });

    it('should handle unrecognised webhook event type without error', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const payload: GithubWebhookPayload = {
        event: 'deployment',
        action: 'created',
        data: {},
      };

      const result = await worker.process(
        mockJob({ type: 'webhook-event', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(0);
    });
  });

  // ─── sync-repository flow ──────────────────────────────────────────────────────

  describe('sync-repository: full repository sync', () => {
    it('should sync open issues only when fullSync is false', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const openIssues = [
        { number: 1, state: 'open', html_url: 'https://github.com/owner/repo/issues/1' },
      ];
      githubService.listIssues.mockResolvedValueOnce(openIssues);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      const payload: GithubSyncRepoPayload = { repo: 'owner/repo', fullSync: false };

      const result = await worker.process(
        mockJob({ type: 'sync-repository', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      // Only called once for open issues
      expect(githubService.listIssues).toHaveBeenCalledTimes(1);
      expect(githubService.listIssues).toHaveBeenCalledWith('owner/repo', {
        state: 'open',
        per_page: 100,
      });

      expect(result).toEqual({
        success: true,
        type: 'sync-repository',
        itemsProcessed: 1,
      });
    });

    it('should sync both open and closed issues when fullSync is true', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const openIssues = [{ number: 1, state: 'open' }];
      const closedIssues = [{ number: 2, state: 'closed' }, { number: 3, state: 'closed' }];
      githubService.listIssues
        .mockResolvedValueOnce(openIssues)
        .mockResolvedValueOnce(closedIssues);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      const payload: GithubSyncRepoPayload = { repo: 'owner/repo', fullSync: true };

      const result = await worker.process(
        mockJob({ type: 'sync-repository', tenantId: 'tenant-1', connectionId: 'conn-1', payload }),
      );

      expect(githubService.listIssues).toHaveBeenCalledTimes(2);
      expect(githubService.listIssues).toHaveBeenNthCalledWith(2, 'owner/repo', {
        state: 'closed',
        per_page: 100,
      });

      expect(result).toEqual({
        success: true,
        type: 'sync-repository',
        itemsProcessed: 3, // 1 open + 2 closed
      });
    });
  });

  // ─── unknown job type ─────────────────────────────────────────────────────────

  describe('unknown job type', () => {
    it('should return failure result for unknown job type', async () => {
      (prisma.githubConnection.findUnique as jest.Mock).mockResolvedValue(mockConnection);

      const result = await worker.process(
        mockJob({
          type: 'unknown-type' as any,
          tenantId: 'tenant-1',
          connectionId: 'conn-1',
          payload: {} as any,
        }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown job type');
    });
  });
});

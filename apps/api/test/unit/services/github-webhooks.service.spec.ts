import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('@octokit/webhooks', () => ({
  Webhooks: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
  })),
}));

import { GithubWebhooksService } from '../../../src/modules/github/services/github-webhooks.service';
import { GithubIssuesService } from '../../../src/modules/github/services/github-issues.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('GithubWebhooksService', () => {
  let service: GithubWebhooksService;
  let prisma: jest.Mocked<PrismaService>;
  let mockQueue: any;

  const mockIssuesService = {
    isSyncFromPlatform: jest.fn().mockResolvedValue(false),
    setSyncOrigin: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubWebhooksService,
        {
          provide: PrismaService,
          useValue: {
            githubIssue: { findFirst: jest.fn(), update: jest.fn() },
            githubInstallation: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn() },
            githubWebhookEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }), update: jest.fn(), deleteMany: jest.fn() },
            ticket: { update: jest.fn() },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'github.webhookSecret') return 'test-webhook-secret';
              return undefined;
            }),
          },
        },
        {
          provide: getQueueToken('github'),
          useValue: mockQueue,
        },
        {
          provide: GithubIssuesService,
          useValue: mockIssuesService,
        },
      ],
    }).compile();

    service = module.get<GithubWebhooksService>(GithubWebhooksService);
    prisma = module.get(PrismaService);

    // Clear shared mock call history
    mockIssuesService.isSyncFromPlatform.mockClear();
    mockIssuesService.setSyncOrigin.mockClear();
    mockIssuesService.isSyncFromPlatform.mockResolvedValue(false);
    mockIssuesService.setSyncOrigin.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const result = await service.verifySignature('payload', 'sha256=abc');
      expect(result).toBe(true);
    });
  });

  describe('processWebhook', () => {
    it('should verify signature and queue event', async () => {
      const payload = { action: 'opened', issue: { number: 1 }, repository: { full_name: 'owner/repo' } };
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await service.processWebhook('issues', payload, 'sha256=abc', 'del-1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'webhook',
        expect.objectContaining({ event: 'issues', deliveryId: 'del-1' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      const { Webhooks } = jest.requireMock('@octokit/webhooks');
      Webhooks.mockImplementationOnce(() => ({
        verify: jest.fn().mockResolvedValue(false),
        on: jest.fn(),
      }));

      const freshModule = await Test.createTestingModule({
        providers: [
          GithubWebhooksService,
          { provide: PrismaService, useValue: { githubIssue: { findFirst: jest.fn() }, githubInstallation: { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn() }, githubWebhookEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }), update: jest.fn(), deleteMany: jest.fn() }, ticket: { update: jest.fn() } } },
          { provide: ConfigService, useValue: { get: jest.fn(() => 'secret') } },
          { provide: getQueueToken('github'), useValue: mockQueue },
          { provide: GithubIssuesService, useValue: mockIssuesService },
        ],
      }).compile();

      const freshService = freshModule.get<GithubWebhooksService>(GithubWebhooksService);

      await expect(
        freshService.processWebhook('issues', {}, 'bad-sig', 'del-1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleEvent', () => {
    it('should handle issue closed event and update ticket', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'closed',
        issue: { number: 42 },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({ status: 'resolved' }),
      });
    });

    it('should handle issue reopened event', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'reopened',
        issue: { number: 42 },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({ status: 'open' }),
      });
    });

    it('should skip unhandled event types', async () => {
      await service.handleEvent('star', { action: 'created' });

      expect(prisma.githubIssue.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── Anti-loop protection ─────────────────────────────────────

  describe('anti-loop protection', () => {
    it('should skip ticket update when change originated from platform', async () => {
      mockIssuesService.isSyncFromPlatform.mockResolvedValue(true);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'closed',
        issue: { number: 42, labels: [] },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('should still update sync status even when anti-loop skips ticket update', async () => {
      mockIssuesService.isSyncFromPlatform.mockResolvedValue(true);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'closed',
        issue: { number: 42, labels: [] },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.githubIssue.update).toHaveBeenCalledWith({
        where: { id: 'gi-1' },
        data: expect.objectContaining({ syncStatus: 'synced' }),
      });
    });

    it('should set sync-origin to "github" before updating ticket on close', async () => {
      mockIssuesService.isSyncFromPlatform.mockResolvedValue(false);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'closed',
        issue: { number: 42, labels: [] },
        repository: { full_name: 'owner/repo' },
      });

      expect(mockIssuesService.setSyncOrigin).toHaveBeenCalledWith(
        'ticket-123',
        'github',
      );

      // setSyncOrigin must be called BEFORE ticket.update
      const syncOrder = mockIssuesService.setSyncOrigin.mock.invocationCallOrder[0];
      const ticketOrder = (prisma.ticket.update as jest.Mock).mock.invocationCallOrder[0];
      expect(syncOrder).toBeLessThan(ticketOrder);
    });

    it('should set sync-origin to "github" before updating ticket on reopen', async () => {
      mockIssuesService.isSyncFromPlatform.mockResolvedValue(false);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'reopened',
        issue: { number: 42, labels: [] },
        repository: { full_name: 'owner/repo' },
      });

      expect(mockIssuesService.setSyncOrigin).toHaveBeenCalledWith(
        'ticket-123',
        'github',
      );
    });

    it('should not update ticket when no linked issue exists', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await service.handleEvent('issues', {
        action: 'closed',
        issue: { number: 99, labels: [] },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(mockIssuesService.setSyncOrigin).not.toHaveBeenCalled();
    });
  });

  // ─── Label sync ───────────────────────────────────────────────

  describe('label sync (issues.labeled / unlabeled)', () => {
    beforeEach(() => {
      mockIssuesService.isSyncFromPlatform.mockResolvedValue(false);
    });

    it('should sync type label to ticket', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'labeled',
        issue: {
          number: 42,
          labels: [{ name: 'type:feature_request' }, { name: 'support' }],
        },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({ type: 'feature_request' }),
      });
    });

    it('should sync severity label to ticket', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'labeled',
        issue: {
          number: 42,
          labels: [{ name: 'severity:critical' }],
        },
        repository: { full_name: 'owner/repo' },
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({ severity: 'critical' }),
      });
    });

    it('should not update ticket when labels have no type:/severity: prefix', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({
        id: 'gi-1',
        ticketId: 'ticket-123',
        ticket: { id: 'ticket-123' },
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('issues', {
        action: 'labeled',
        issue: {
          number: 42,
          labels: [{ name: 'support' }, { name: 'wontfix' }],
        },
        repository: { full_name: 'owner/repo' },
      });

      // ticket.update should NOT have been called for label sync
      // (it's only called for status changes)
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  // ─── Check run event ──────────────────────────────────────────

  describe('handleEvent — check_run', () => {
    it('should process completed check runs without error', async () => {
      await expect(
        service.handleEvent('check_run', {
          action: 'completed',
          check_run: {
            name: 'CI',
            conclusion: 'success',
            head_sha: 'abc123',
            pull_requests: [],
          },
          repository: { full_name: 'owner/repo' },
        }),
      ).resolves.not.toThrow();
    });

    it('should ignore non-completed check runs', async () => {
      await expect(
        service.handleEvent('check_run', {
          action: 'created',
          check_run: {
            name: 'CI',
            conclusion: null,
            head_sha: 'abc123',
            pull_requests: [],
          },
          repository: { full_name: 'owner/repo' },
        }),
      ).resolves.not.toThrow();
    });
  });

  // ─── Installation event ───────────────────────────────────────

  describe('handleEvent — installation', () => {
    it('should delete installation record on "deleted" action', async () => {
      (prisma.githubInstallation.delete as jest.Mock).mockResolvedValue({});

      await service.handleEvent('installation', {
        action: 'deleted',
        installation: {
          id: 12345,
          account: { login: 'org', type: 'Organization' },
        },
        sender: { login: 'user', id: 1 },
      });

      expect(prisma.githubInstallation.delete).toHaveBeenCalledWith({
        where: { installationId: BigInt(12345) },
      });
    });

    it('should suspend installation on "suspend" action', async () => {
      (prisma.githubInstallation.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('installation', {
        action: 'suspend',
        installation: {
          id: 12345,
          account: { login: 'org', type: 'Organization' },
        },
        sender: { login: 'user', id: 1 },
      });

      expect(prisma.githubInstallation.update).toHaveBeenCalledWith({
        where: { installationId: BigInt(12345) },
        data: { suspendedAt: expect.any(Date) },
      });
    });

    it('should unsuspend installation on "unsuspend" action', async () => {
      (prisma.githubInstallation.update as jest.Mock).mockResolvedValue({});

      await service.handleEvent('installation', {
        action: 'unsuspend',
        installation: {
          id: 12345,
          account: { login: 'org', type: 'Organization' },
        },
        sender: { login: 'user', id: 1 },
      });

      expect(prisma.githubInstallation.update).toHaveBeenCalledWith({
        where: { installationId: BigInt(12345) },
        data: { suspendedAt: null },
      });
    });

    it('should not throw when installation record does not exist on delete', async () => {
      (prisma.githubInstallation.delete as jest.Mock).mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.handleEvent('installation', {
          action: 'deleted',
          installation: {
            id: 99999,
            account: { login: 'org', type: 'Organization' },
          },
          sender: { login: 'user', id: 1 },
        }),
      ).resolves.not.toThrow();
    });
  });

  // ─── Cleanup old events ───────────────────────────────────────

  describe('cleanupOldEvents', () => {
    it('should delete events older than specified days', async () => {
      (prisma.githubWebhookEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 15,
      });

      const count = await service.cleanupOldEvents(30);

      expect(count).toBe(15);
      expect(prisma.githubWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should default to 30 days', async () => {
      (prisma.githubWebhookEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await service.cleanupOldEvents();

      const cutoffArg = (prisma.githubWebhookEvent.deleteMany as jest.Mock)
        .mock.calls[0][0].where.createdAt.lt;
      const daysDiff =
        (Date.now() - cutoffArg.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
    });
  });

  // ─── Webhook event logging ────────────────────────────────────

  describe('processWebhook — event logging', () => {
    it('should create a webhook event record before processing', async () => {
      const payload = {
        action: 'opened',
        issue: { number: 1, labels: [] },
        repository: { full_name: 'owner/repo' },
        installation: { id: 12345 },
      };

      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await service.processWebhook('issues', payload, 'sha256=abc', 'del-1');

      expect(prisma.githubWebhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'issues',
          action: 'opened',
          processed: false,
        }),
      });
    });

    it('should mark event as processed after successful handling', async () => {
      const payload = {
        action: 'opened',
        issue: { number: 1, labels: [] },
        repository: { full_name: 'owner/repo' },
      };

      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await service.processWebhook('issues', payload, 'sha256=abc', 'del-1');

      expect(prisma.githubWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { processed: true },
      });
    });
  });
});

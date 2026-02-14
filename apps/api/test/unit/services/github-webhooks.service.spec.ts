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
});

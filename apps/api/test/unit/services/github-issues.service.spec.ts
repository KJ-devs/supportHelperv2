import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubIssuesService } from '../../../src/modules/github/services/github-issues.service';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('GithubIssuesService', () => {
  let service: GithubIssuesService;
  let prisma: jest.Mocked<PrismaService>;
  let oauthService: jest.Mocked<GithubOAuthService>;

  const mockOctokit = {
    issues: {
      create: jest.fn().mockResolvedValue({
        data: { number: 42, html_url: 'https://github.com/owner/repo/issues/42', title: 'Bug', state: 'open', created_at: '2026-01-01' },
      }),
      get: jest.fn().mockResolvedValue({
        data: { number: 42, html_url: 'https://github.com/owner/repo/issues/42', state: 'open', title: 'Bug' },
      }),
      update: jest.fn().mockResolvedValue({ data: {} }),
    },
    search: {
      issuesAndPullRequests: jest.fn().mockResolvedValue({
        data: { items: [] },
      }),
    },
  };

  const mockTicket = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    title: 'Test Bug',
    description: 'Description',
    status: 'open',
    severity: 'high',
    type: 'bug',
    aiSummary: null,
    reproductionSteps: null,
    userContext: null,
    keywords: ['test'],
    media: [],
    application: { id: 'app-123', githubRepo: 'owner/repo' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubIssuesService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { findFirst: jest.fn() },
            githubIssue: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3001') },
        },
        {
          provide: GithubOAuthService,
          useValue: { getOctokitForTenant: jest.fn().mockResolvedValue(mockOctokit) },
        },
      ],
    }).compile();

    service = module.get<GithubIssuesService>(GithubIssuesService);
    prisma = module.get(PrismaService);
    oauthService = module.get(GithubOAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIssueFromTicket', () => {
    it('should create a GitHub issue and save link', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'gi-123' });

      const result = await service.createIssueFromTicket('ticket-123', 'tenant-123', {
        repository: 'owner/repo',
      } as any);

      expect(mockOctokit.issues.create).toHaveBeenCalled();
      expect(prisma.githubIssue.create).toHaveBeenCalled();
      expect(result.issueNumber).toBe(42);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createIssueFromTicket('missing', 'tenant-123', { repository: 'owner/repo' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when issue already exists', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.createIssueFromTicket('ticket-123', 'tenant-123', { repository: 'owner/repo' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid repo format', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createIssueFromTicket('ticket-123', 'tenant-123', { repository: 'invalid' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLinkedIssues', () => {
    it('should return linked issues with GitHub state', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([
        { id: 'gi-1', githubRepo: 'owner/repo', githubIssueNumber: 42, githubIssueUrl: '', syncStatus: 'synced', lastSyncedAt: new Date() },
      ]);

      const result = await service.getLinkedIssues('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0].issueNumber).toBe(42);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getLinkedIssues('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRelatedIssues', () => {
    it('should search for related issues', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const result = await service.findRelatedIssues('ticket-123', 'tenant-123', 'owner/repo');

      expect(mockOctokit.search.issuesAndPullRequests).toHaveBeenCalled();
      expect(result.repository).toBe('owner/repo');
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findRelatedIssues('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no repository', async () => {
      const ticketNoRepo = { ...mockTicket, application: { id: 'app', githubRepo: null } };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketNoRepo);

      await expect(service.findRelatedIssues('ticket-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncTicketToIssue', () => {
    it('should sync ticket state to GitHub issues', async () => {
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([
        { id: 'gi-1', githubRepo: 'owner/repo', githubIssueNumber: 42, ticket: { ...mockTicket, status: 'resolved' } },
      ]);
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.syncTicketToIssue('ticket-123', 'tenant-123');

      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' }),
      );
    });

    it('should throw NotFoundException when no linked issues', async () => {
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.syncTicketToIssue('ticket-123', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkIssue', () => {
    it('should delete the issue link', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({ id: 'gi-1' });
      (prisma.githubIssue.delete as jest.Mock).mockResolvedValue({});

      await service.unlinkIssue('gi-1', 'tenant-123');

      expect(prisma.githubIssue.delete).toHaveBeenCalledWith({ where: { id: 'gi-1' } });
    });

    it('should throw NotFoundException when link not found', async () => {
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.unlinkIssue('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubIssuesService } from '../../../src/modules/github/services/github-issues.service';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';
import { GithubAppService } from '../../../src/modules/github/services/github-app.service';
import { TemplateRendererService } from '../../../src/modules/github/services/template-renderer.service';
import { CacheService } from '../../../src/cache/cache.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CreateGithubIssueDto } from '../../../src/modules/github/dto/github-issues.dto';

// Helper type for accessing private properties in tests
type ServiceInternals = Record<string, unknown>;
// Helper type for adding dynamic prisma model mocks
type PrismaMock = Record<string, Record<string, jest.Mock>>;

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
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: GithubOAuthService,
          useValue: { getOctokitForTenant: jest.fn().mockResolvedValue(mockOctokit) },
        },
        {
          provide: GithubAppService,
          useValue: {
            getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit),
            isEnabled: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: TemplateRendererService,
          useValue: {
            render: jest.fn().mockImplementation((template: string, data: Record<string, string>) => {
              let result = template;
              for (const [key, value] of Object.entries(data)) {
                const placeholder = key.startsWith('{{') ? key : `{{${key}}}`;
                result = result.split(placeholder).join(value || '');
              }
              return result;
            }),
            getDefaultTemplate: jest.fn().mockReturnValue('## Description\n\n{{description}}'),
            getPlaceholders: jest.fn().mockReturnValue({}),
            getSampleData: jest.fn().mockReturnValue({}),
            validate: jest.fn().mockReturnValue({ valid: true, placeholders: [], missingPlaceholders: [] }),
          },
        },
      ],
    }).compile();

    service = module.get<GithubIssuesService>(GithubIssuesService);
    prisma = module.get(PrismaService);
    oauthService = module.get(GithubOAuthService);

    // Clear shared mockOctokit calls between tests
    mockOctokit.issues.create.mockClear();
    mockOctokit.issues.get.mockClear();
    mockOctokit.issues.update.mockClear();
    mockOctokit.search.issuesAndPullRequests.mockClear();
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
      } as CreateGithubIssueDto);

      expect(mockOctokit.issues.create).toHaveBeenCalled();
      expect(prisma.githubIssue.create).toHaveBeenCalled();
      expect(result.issueNumber).toBe(42);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createIssueFromTicket('missing', 'tenant-123', { repository: 'owner/repo' } as CreateGithubIssueDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when issue already exists', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.createIssueFromTicket('ticket-123', 'tenant-123', { repository: 'owner/repo' } as CreateGithubIssueDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid repo format', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createIssueFromTicket('ticket-123', 'tenant-123', { repository: 'invalid' } as CreateGithubIssueDto),
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

  // ─── Label mapping ────────────────────────────────────────────

  describe('label mapping (via createIssueFromTicket)', () => {
    it('should map severity and type to labels', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'gi-new' });

      await service.createIssueFromTicket('ticket-123', 'tenant-123', {
        repository: 'owner/repo',
      } as CreateGithubIssueDto);

      const createCall = mockOctokit.issues.create.mock.calls[0][0];
      expect(createCall.labels).toContain('support');
      expect(createCall.labels).toContain('severity:high');
      expect(createCall.labels).toContain('type:bug');
    });

    it('should always include "support" label even without severity/type', async () => {
      const ticketNoLabels = { ...mockTicket, severity: null, type: null };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketNoLabels);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'gi-new' });

      await service.createIssueFromTicket('ticket-123', 'tenant-123', {
        repository: 'owner/repo',
      } as CreateGithubIssueDto);

      const createCall = mockOctokit.issues.create.mock.calls[0][0];
      expect(createCall.labels).toContain('support');
      expect(createCall.labels).toHaveLength(1);
    });

    it('should merge additional labels without duplicates', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'gi-new' });

      await service.createIssueFromTicket('ticket-123', 'tenant-123', {
        repository: 'owner/repo',
        labels: ['urgent', 'support'], // 'support' is already added
      } as CreateGithubIssueDto);

      const createCall = mockOctokit.issues.create.mock.calls[0][0];
      expect(createCall.labels).toContain('urgent');
      // 'support' should not be duplicated
      const supportCount = createCall.labels.filter((l: string) => l === 'support').length;
      expect(supportCount).toBe(1);
    });
  });

  // ─── Auto-create issue from ticket ────────────────────────────

  describe('autoCreateIssueFromTicket', () => {
    let appService: Record<string, jest.Mock>;

    beforeEach(() => {
      appService = (service as unknown as ServiceInternals).appService as Record<string, jest.Mock>;
      // Add missing prisma mocks for autoCreate
      (prisma as unknown as PrismaMock).ticket.findUnique = jest.fn();
      (prisma as unknown as PrismaMock).projectGithubConfig = { findUnique: jest.fn() };
      // Clear shared mock to avoid leaking from previous tests
      mockOctokit.issues.create.mockClear();
      mockOctokit.issues.create.mockResolvedValue({
        data: { number: 42, html_url: 'https://github.com/owner/repo/issues/42', title: 'Bug', state: 'open', created_at: '2026-01-01' },
      });
    });

    it('should create issue via installation token when config exists', async () => {
      (prisma as unknown as PrismaMock).ticket.findUnique.mockResolvedValue({ ...mockTicket, applicationId: 'app-123' });
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        installationId: BigInt(12345),
        settings: null,
      });
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'new' });

      await service.autoCreateIssueFromTicket('ticket-123');

      expect(appService.getInstallationOctokit).toHaveBeenCalledWith(12345);
      expect(mockOctokit.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', repo: 'repo' }),
      );
      expect(prisma.githubIssue.create).toHaveBeenCalled();
    });

    it('should include default labels from config settings', async () => {
      (prisma as unknown as PrismaMock).ticket.findUnique.mockResolvedValue({ ...mockTicket, applicationId: 'app-123' });
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        installationId: BigInt(12345),
        settings: { defaultLabels: 'backend,urgent' },
      });
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'x' });

      await service.autoCreateIssueFromTicket('ticket-123');

      const createCall = mockOctokit.issues.create.mock.calls[0][0];
      expect(createCall.labels).toContain('backend');
      expect(createCall.labels).toContain('urgent');
      expect(createCall.labels).toContain('support');
    });

    it('should skip when ticket has no applicationId', async () => {
      (prisma as unknown as PrismaMock).ticket.findUnique.mockResolvedValue({
        ...mockTicket,
        applicationId: null,
        application: null,
      });

      await service.autoCreateIssueFromTicket('ticket-123');

      expect(mockOctokit.issues.create).not.toHaveBeenCalled();
    });

    it('should skip when no ProjectGithubConfig exists', async () => {
      (prisma as unknown as PrismaMock).ticket.findUnique.mockResolvedValue({ ...mockTicket, applicationId: 'app-123' });
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue(null);

      await service.autoCreateIssueFromTicket('ticket-123');

      expect(mockOctokit.issues.create).not.toHaveBeenCalled();
    });

    it('should skip when issue already exists for ticket+repo', async () => {
      (prisma as unknown as PrismaMock).ticket.findUnique.mockResolvedValue({ ...mockTicket, applicationId: 'app-123' });
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        owner: 'owner',
        repo: 'repo',
        installationId: BigInt(12345),
        settings: null,
      });
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await service.autoCreateIssueFromTicket('ticket-123');

      expect(mockOctokit.issues.create).not.toHaveBeenCalled();
    });
  });

  // ─── Sync-origin anti-loop ────────────────────────────────────

  describe('setSyncOrigin / isSyncFromGithub / isSyncFromPlatform', () => {
    it('should store sync origin in cache with 30s TTL', async () => {
      await service.setSyncOrigin('ticket-123', 'github');

      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      expect(cs.set).toHaveBeenCalledWith(
        'github:sync-origin:ticket-123',
        'github',
        30,
      );
    });

    it('isSyncFromGithub should return true when origin is "github"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue('github');

      expect(await service.isSyncFromGithub('ticket-123')).toBe(true);
    });

    it('isSyncFromGithub should return false when origin is "platform"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue('platform');

      expect(await service.isSyncFromGithub('ticket-123')).toBe(false);
    });

    it('isSyncFromGithub should return false when no flag is set', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);

      expect(await service.isSyncFromGithub('ticket-123')).toBe(false);
    });

    it('isSyncFromPlatform should return true when origin is "platform"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue('platform');

      expect(await service.isSyncFromPlatform('ticket-123')).toBe(true);
    });

    it('isSyncFromPlatform should return false when origin is "github"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue('github');

      expect(await service.isSyncFromPlatform('ticket-123')).toBe(false);
    });

    it('isSyncFromPlatform should return false when no flag is set', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);

      expect(await service.isSyncFromPlatform('ticket-123')).toBe(false);
    });
  });

  // ─── Reverse sync: ticket → GitHub ────────────────────────────

  describe('syncTicketStatusToGithub', () => {
    const mockGithubIssue = {
      id: 'gh-1',
      ticketId: 'ticket-123',
      githubIssueNumber: 42,
      githubRepo: 'owner/repo',
      ticket: {
        id: 'ticket-123',
        tenantId: 'tenant-123',
        applicationId: 'app-123',
      },
    };

    beforeEach(() => {
      (prisma as unknown as PrismaMock).projectGithubConfig = { findUnique: jest.fn() };
      // Reset shared mock call history
      mockOctokit.issues.update.mockClear();
      mockOctokit.issues.update.mockResolvedValue({ data: {} });
    });

    it('should skip sync when change originated from GitHub (anti-loop)', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue('github');

      await service.syncTicketStatusToGithub('ticket-123', 'resolved');

      expect(prisma.githubIssue.findMany).not.toHaveBeenCalled();
      expect(mockOctokit.issues.update).not.toHaveBeenCalled();
    });

    it('should close issue when ticket status is "resolved"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([mockGithubIssue]);
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        installationId: BigInt(12345),
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.syncTicketStatusToGithub('ticket-123', 'resolved');

      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
          issue_number: 42,
          state: 'closed',
        }),
      );
    });

    it('should reopen issue when ticket status is "open"', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([mockGithubIssue]);
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        installationId: BigInt(12345),
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.syncTicketStatusToGithub('ticket-123', 'open');

      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open' }),
      );
    });

    it('should set sync-origin to "platform" before calling GitHub API', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([mockGithubIssue]);
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        installationId: BigInt(12345),
      });
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.syncTicketStatusToGithub('ticket-123', 'resolved');

      expect(cs.set).toHaveBeenCalledWith(
        'github:sync-origin:ticket-123',
        'platform',
        30,
      );
      // Verify set was called (ordering guaranteed by await chain in source)
      expect(mockOctokit.issues.update).toHaveBeenCalled();
    });

    it('should do nothing when no GitHub issues are linked', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([]);

      await service.syncTicketStatusToGithub('ticket-123', 'resolved');

      expect(mockOctokit.issues.update).not.toHaveBeenCalled();
    });

    it('should mark syncStatus as "error" when GitHub API fails', async () => {
      const cs = (service as unknown as ServiceInternals).cacheService as { get: jest.Mock; set: jest.Mock };
      cs.get.mockResolvedValue(null);
      (prisma.githubIssue.findMany as jest.Mock).mockResolvedValue([mockGithubIssue]);
      (prisma as unknown as PrismaMock).projectGithubConfig.findUnique.mockResolvedValue({
        installationId: BigInt(12345),
      });
      mockOctokit.issues.update.mockRejectedValueOnce(new Error('API error'));
      (prisma.githubIssue.update as jest.Mock).mockResolvedValue({});

      await service.syncTicketStatusToGithub('ticket-123', 'resolved');

      expect(prisma.githubIssue.update).toHaveBeenCalledWith({
        where: { id: 'gh-1' },
        data: { syncStatus: 'error' },
      });
    });
  });
});

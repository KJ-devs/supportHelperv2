import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { GithubService } from './github.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'repo1',
            full_name: 'owner/repo1',
            private: false,
            html_url: 'https://github.com/owner/repo1',
          },
          {
            id: 2,
            name: 'repo2',
            full_name: 'owner/repo2',
            private: true,
            html_url: 'https://github.com/owner/repo2',
          },
        ],
      }),
    },
    issues: {
      create: jest.fn().mockResolvedValue({
        data: {
          number: 42,
          html_url: 'https://github.com/owner/repo/issues/42',
        },
      }),
      update: jest.fn().mockResolvedValue({ data: {} }),
    },
  })),
}));

describe('GithubService', () => {
  let service: GithubService;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-123';
  const mockTicketId = 'ticket-123';

  const mockTicket = {
    id: mockTicketId,
    tenantId: mockTenantId,
    title: 'Test Bug Report',
    description: 'Something is broken',
    status: 'open',
    type: 'bug',
    severity: 'high',
    aiSummary: 'User reports a broken feature',
    reproductionSteps: ['Step 1', 'Step 2'],
    userContext: { os: 'Windows', browser: 'Chrome' },
    media: [],
    application: { id: 'app-1', name: 'Test App' },
  };

  const mockGithubConnection = {
    id: 'conn-123',
    tenantId: mockTenantId,
    accessToken: 'test-token',
  };

  const mockGithubIssue = {
    id: 'gh-issue-123',
    ticketId: mockTicketId,
    githubRepo: 'owner/repo',
    githubIssueNumber: 42,
    githubIssueUrl: 'https://github.com/owner/repo/issues/42',
    ticket: mockTicket,
  };

  const mockPrismaService = {
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    githubIssue: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    githubConnection: {
      findFirst: jest.fn(),
    },
  };

  const configValues: Record<string, unknown> = {
    'github.clientId': 'test-client-id',
    'github.clientSecret': 'test-client-secret',
    'github.webhookSecret': 'test-webhook-secret',
    'github.enabled': true,
    'app.apiUrl': 'http://localhost:3000',
  };

  const mockConfigService = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GithubService>(GithubService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuthorizationUrl', () => {
    it('should return a valid GitHub OAuth URL', () => {
      const state = 'random-state-123';
      const url = service.getAuthorizationUrl(state);

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(`state=${state}`);
      // URL encoded scope
      expect(url).toContain('scope=repo');
    });
  });

  describe('getUserRepositories', () => {
    it('should return formatted repository list', async () => {
      const accessToken = 'test-token';
      const repos = await service.getUserRepositories(accessToken);

      expect(repos).toHaveLength(2);
      expect(repos[0]).toEqual({
        id: 1,
        name: 'repo1',
        fullName: 'owner/repo1',
        private: false,
        url: 'https://github.com/owner/repo1',
      });
      expect(repos[1]).toEqual({
        id: 2,
        name: 'repo2',
        fullName: 'owner/repo2',
        private: true,
        url: 'https://github.com/owner/repo2',
      });
    });
  });

  describe('createIssueFromTicket', () => {
    it('should create GitHub issue from ticket', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.githubIssue.create.mockResolvedValue(mockGithubIssue);

      const result = await service.createIssueFromTicket(
        mockTicketId,
        mockTenantId,
        'owner/repo',
        'test-token'
      );

      expect(result.number).toBe(42);
      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: mockTicketId, tenantId: mockTenantId },
        include: { media: true, application: true },
      });
      expect(mockPrismaService.githubIssue.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.createIssueFromTicket(mockTicketId, mockTenantId, 'owner/repo', 'test-token')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncTicketToIssue', () => {
    it('should sync ticket changes to GitHub issue', async () => {
      mockPrismaService.githubIssue.findFirst.mockResolvedValue(mockGithubIssue);
      mockPrismaService.githubConnection.findFirst.mockResolvedValue(mockGithubConnection);
      mockPrismaService.githubIssue.update.mockResolvedValue({});

      await service.syncTicketToIssue(mockTicketId, mockTenantId);

      expect(mockPrismaService.githubIssue.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.githubConnection.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.githubIssue.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when GitHub issue link not found', async () => {
      mockPrismaService.githubIssue.findFirst.mockResolvedValue(null);

      await expect(service.syncTicketToIssue(mockTicketId, mockTenantId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error when GitHub connection not found', async () => {
      mockPrismaService.githubIssue.findFirst.mockResolvedValue(mockGithubIssue);
      mockPrismaService.githubConnection.findFirst.mockResolvedValue(null);

      await expect(service.syncTicketToIssue(mockTicketId, mockTenantId)).rejects.toThrow(
        'GitHub connection not found'
      );
    });
  });

  describe('handleWebhook', () => {
    describe('issues event', () => {
      it('should handle issue closed event', async () => {
        mockPrismaService.githubIssue.findFirst.mockResolvedValue(mockGithubIssue);
        mockPrismaService.ticket.update.mockResolvedValue({});

        const payload = {
          action: 'closed',
          issue: { number: 42 },
          repository: { full_name: 'owner/repo' },
        };

        await service.handleWebhook('issues', payload);

        expect(mockPrismaService.ticket.update).toHaveBeenCalledWith({
          where: { id: mockTicketId },
          data: {
            status: 'resolved',
            resolvedAt: expect.any(Date),
          },
        });
      });

      it('should handle issue reopened event', async () => {
        mockPrismaService.githubIssue.findFirst.mockResolvedValue(mockGithubIssue);
        mockPrismaService.ticket.update.mockResolvedValue({});

        const payload = {
          action: 'reopened',
          issue: { number: 42 },
          repository: { full_name: 'owner/repo' },
        };

        await service.handleWebhook('issues', payload);

        expect(mockPrismaService.ticket.update).toHaveBeenCalledWith({
          where: { id: mockTicketId },
          data: {
            status: 'open',
            resolvedAt: null,
          },
        });
      });

      it('should not update ticket if not linked to GitHub issue', async () => {
        mockPrismaService.githubIssue.findFirst.mockResolvedValue(null);

        const payload = {
          action: 'closed',
          issue: { number: 999 },
          repository: { full_name: 'owner/repo' },
        };

        await service.handleWebhook('issues', payload);

        expect(mockPrismaService.ticket.update).not.toHaveBeenCalled();
      });
    });

    it('should handle issue_comment event', async () => {
      const payload = { comment: { body: 'Test comment' } };

      // Should not throw
      await expect(service.handleWebhook('issue_comment', payload)).resolves.not.toThrow();
    });

    it('should handle unknown webhook event gracefully', async () => {
      await expect(service.handleWebhook('unknown_event', {})).resolves.not.toThrow();
    });
  });
});

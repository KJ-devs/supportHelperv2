import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubUserstoryService } from '../../../src/modules/github/services/github-userstory.service';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';
import { AIService } from '../../../src/ai/ai.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('GithubUserstoryService', () => {
  let service: GithubUserstoryService;
  let prisma: jest.Mocked<PrismaService>;
  let aiService: jest.Mocked<AIService>;
  let oauthService: jest.Mocked<GithubOAuthService>;

  const mockOctokit = {
    issues: {
      create: jest.fn().mockResolvedValue({
        data: {
          number: 43,
          html_url: 'https://github.com/owner/repo/issues/43',
          title: 'As a user...',
          state: 'open',
          created_at: '2026-01-01',
        },
      }),
    },
  };

  const mockTicket = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    title: 'Test Bug',
    description: 'Bug description',
    status: 'open',
    severity: 'high',
    type: 'bug',
    aiSummary: 'AI summary',
    aiAnalysis: null,
    keywords: ['test'],
    reproductionSteps: null,
    media: [],
    agentSessions: [],
    application: { id: 'app-123' },
  };

  const mockUserStoryJson = JSON.stringify({
    title: 'As a user, I want the bug fixed',
    description: 'Detailed description',
    acceptanceCriteria: ['Given X, When Y, Then Z'],
    technicalNotes: 'Check component A',
    labels: ['bug', 'enhancement'],
    priority: 'high',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubUserstoryService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { findFirst: jest.fn() },
            githubIssue: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
        {
          provide: AIService,
          useValue: { generateCompletion: jest.fn() },
        },
        {
          provide: GithubOAuthService,
          useValue: { getOctokitForTenant: jest.fn().mockResolvedValue(mockOctokit) },
        },
      ],
    }).compile();

    service = module.get<GithubUserstoryService>(GithubUserstoryService);
    prisma = module.get(PrismaService);
    aiService = module.get(AIService);
    oauthService = module.get(GithubOAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUserStory', () => {
    it('should generate user story from ticket via AI', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(mockUserStoryJson);

      const result = await service.generateUserStory('ticket-123', 'tenant-123');

      expect(aiService.generateCompletion).toHaveBeenCalled();
      expect(result.title).toBe('As a user, I want the bug fixed');
      expect(result.acceptanceCriteria).toHaveLength(1);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.generateUserStory('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when AI returns empty', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue('');

      await expect(service.generateUserStory('ticket-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when AI returns invalid JSON', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue('not json');

      await expect(service.generateUserStory('ticket-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createUserStoryIssue', () => {
    it('should generate story and create GitHub issue', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubIssue.create as jest.Mock).mockResolvedValue({ id: 'gi-2' });
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(mockUserStoryJson);

      const result = await service.createUserStoryIssue('ticket-123', 'tenant-123', {
        repository: 'owner/repo',
      } as any);

      expect(mockOctokit.issues.create).toHaveBeenCalled();
      expect(prisma.githubIssue.create).toHaveBeenCalled();
      expect(result.issue.issueNumber).toBe(43);
      expect(result.userStory.title).toContain('bug fixed');
    });

    it('should throw BadRequestException when user story already exists', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(mockUserStoryJson);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUserStoryIssue('ticket-123', 'tenant-123', { repository: 'owner/repo' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid repo format', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(mockUserStoryJson);
      (prisma.githubIssue.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createUserStoryIssue('ticket-123', 'tenant-123', { repository: 'invalid' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

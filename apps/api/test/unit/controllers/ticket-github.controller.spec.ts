import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { TicketGithubController } from '../../../src/modules/github/controllers/ticket-github.controller';
import { GithubIssuesService } from '../../../src/modules/github/services/github-issues.service';
import { GithubUserstoryService } from '../../../src/modules/github/services/github-userstory.service';

describe('TicketGithubController', () => {
  let controller: TicketGithubController;
  let issuesService: jest.Mocked<GithubIssuesService>;
  let userstoryService: jest.Mocked<GithubUserstoryService>;

  const mockIssueResponse = {
    id: 'gh-issue-123',
    issueNumber: 42,
    issueUrl: 'https://github.com/owner/repo/issues/42',
    repository: 'owner/repo',
    title: 'Bug report',
    state: 'open',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketGithubController],
      providers: [
        {
          provide: GithubIssuesService,
          useValue: {
            createIssueFromTicket: jest.fn(),
            getLinkedIssues: jest.fn(),
            findRelatedIssues: jest.fn(),
            syncTicketToIssue: jest.fn(),
            unlinkIssue: jest.fn(),
          },
        },
        {
          provide: GithubUserstoryService,
          useValue: {
            createUserStoryIssue: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketGithubController>(TicketGithubController);
    issuesService = module.get(GithubIssuesService);
    userstoryService = module.get(GithubUserstoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createIssue', () => {
    it('should create GitHub issue from ticket', async () => {
      const dto = { repository: 'owner/repo', title: 'Bug' } as unknown;
      (issuesService.createIssueFromTicket as jest.Mock).mockResolvedValue(mockIssueResponse);

      const result = await controller.createIssue('tenant-123', 'ticket-123', dto);

      expect(issuesService.createIssueFromTicket).toHaveBeenCalledWith('ticket-123', 'tenant-123', dto);
      expect(result).toEqual(mockIssueResponse);
    });
  });

  describe('getLinkedIssues', () => {
    it('should return linked issues', async () => {
      const mockIssues = [mockIssueResponse];
      (issuesService.getLinkedIssues as jest.Mock).mockResolvedValue(mockIssues);

      const result = await controller.getLinkedIssues('tenant-123', 'ticket-123');

      expect(issuesService.getLinkedIssues).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toEqual({ issues: mockIssues });
    });

    it('should return empty array when no linked issues', async () => {
      (issuesService.getLinkedIssues as jest.Mock).mockResolvedValue([]);

      const result = await controller.getLinkedIssues('tenant-123', 'ticket-123');

      expect(result).toEqual({ issues: [] });
    });
  });

  describe('findRelatedIssues', () => {
    it('should find related issues without repository filter', async () => {
      const mockRelated = { issues: [], query: 'test', repository: 'owner/repo' };
      (issuesService.findRelatedIssues as jest.Mock).mockResolvedValue(mockRelated);

      const result = await controller.findRelatedIssues('tenant-123', 'ticket-123');

      expect(issuesService.findRelatedIssues).toHaveBeenCalledWith('ticket-123', 'tenant-123', undefined);
      expect(result).toEqual(mockRelated);
    });

    it('should find related issues with repository filter', async () => {
      const mockRelated = { issues: [], query: 'test', repository: 'owner/specific' };
      (issuesService.findRelatedIssues as jest.Mock).mockResolvedValue(mockRelated);

      const result = await controller.findRelatedIssues('tenant-123', 'ticket-123', 'owner/specific');

      expect(issuesService.findRelatedIssues).toHaveBeenCalledWith('ticket-123', 'tenant-123', 'owner/specific');
    });
  });

  describe('syncTicket', () => {
    it('should sync ticket and return success', async () => {
      (issuesService.syncTicketToIssue as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.syncTicket('tenant-123', 'ticket-123');

      expect(issuesService.syncTicketToIssue).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unlinkIssue', () => {
    it('should unlink issue and return success', async () => {
      (issuesService.unlinkIssue as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.unlinkIssue('tenant-123', 'issue-123');

      expect(issuesService.unlinkIssue).toHaveBeenCalledWith('issue-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('createUserStory', () => {
    it('should create user story issue from ticket', async () => {
      const dto = { repository: 'owner/repo' } as unknown;
      const mockResult = {
        issue: mockIssueResponse,
        userStory: { title: 'As a user...', acceptanceCriteria: [] },
      };
      (userstoryService.createUserStoryIssue as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.createUserStory('tenant-123', 'ticket-123', dto);

      expect(userstoryService.createUserStoryIssue).toHaveBeenCalledWith('ticket-123', 'tenant-123', dto);
      expect(result).toEqual(mockResult);
    });
  });
});

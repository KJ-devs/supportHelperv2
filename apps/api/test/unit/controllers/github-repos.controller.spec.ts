import { Test, TestingModule } from '@nestjs/testing';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubReposController } from '../../../src/modules/github/controllers/github-repos.controller';
import { GithubReposService } from '../../../src/modules/github/services/github-repos.service';

describe('GithubReposController', () => {
  let controller: GithubReposController;
  let reposService: jest.Mocked<GithubReposService>;

  const mockRepo = {
    id: 123456,
    name: 'test-repo',
    fullName: 'owner/test-repo',
    private: false,
    url: 'https://github.com/owner/test-repo',
    defaultBranch: 'main',
    starCount: 10,
    openIssuesCount: 5,
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GithubReposController],
      providers: [
        {
          provide: GithubReposService,
          useValue: {
            listRepositories: jest.fn(),
            getConnectedRepositories: jest.fn(),
            getRepository: jest.fn(),
            linkRepository: jest.fn(),
            unlinkRepository: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GithubReposController>(GithubReposController);
    reposService = module.get(GithubReposService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listRepositories (POST)', () => {
    it('should call reposService.listRepositories with query', async () => {
      const query = { page: 1, perPage: 30 } as unknown;
      const mockResponse = { repositories: [mockRepo], total: 1, page: 1, hasMore: false };
      (reposService.listRepositories as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.listRepositories('tenant-123', query);

      expect(reposService.listRepositories).toHaveBeenCalledWith('tenant-123', query);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listRepositoriesGet (GET)', () => {
    it('should call reposService.listRepositories via GET', async () => {
      const query = { page: 2 } as unknown;
      const mockResponse = { repositories: [], total: 0, page: 2, hasMore: false };
      (reposService.listRepositories as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.listRepositoriesGet('tenant-123', query);

      expect(reposService.listRepositories).toHaveBeenCalledWith('tenant-123', query);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('connectedRepositories', () => {
    it('should return connected repositories', async () => {
      (reposService.getConnectedRepositories as jest.Mock).mockResolvedValue(['owner/repo1', 'owner/repo2']);

      const result = await controller.connectedRepositories('tenant-123');

      expect(result).toEqual({ repositories: ['owner/repo1', 'owner/repo2'] });
    });

    it('should return empty array when none connected', async () => {
      (reposService.getConnectedRepositories as jest.Mock).mockResolvedValue([]);

      const result = await controller.connectedRepositories('tenant-123');

      expect(result).toEqual({ repositories: [] });
    });
  });

  describe('getRepository', () => {
    it('should combine owner and repo params', async () => {
      (reposService.getRepository as jest.Mock).mockResolvedValue(mockRepo);

      const result = await controller.getRepository('tenant-123', 'owner', 'test-repo');

      expect(reposService.getRepository).toHaveBeenCalledWith('tenant-123', 'owner/test-repo');
      expect(result).toEqual(mockRepo);
    });
  });

  describe('linkRepository', () => {
    it('should link repository to application', async () => {
      const dto = { applicationId: 'app-123', repository: 'owner/repo' };
      const mockResult = { id: 'app-123', githubRepo: 'owner/repo' };
      (reposService.linkRepository as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.linkRepository('tenant-123', dto);

      expect(reposService.linkRepository).toHaveBeenCalledWith('tenant-123', 'app-123', 'owner/repo');
      expect(result).toEqual(mockResult);
    });
  });

  describe('unlinkRepository', () => {
    it('should unlink repository from application', async () => {
      const mockResult = { id: 'app-123', githubRepo: null };
      (reposService.unlinkRepository as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.unlinkRepository('tenant-123', 'app-123');

      expect(reposService.unlinkRepository).toHaveBeenCalledWith('tenant-123', 'app-123');
      expect(result).toEqual(mockResult);
    });
  });
});

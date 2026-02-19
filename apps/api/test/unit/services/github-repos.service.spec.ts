import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { GithubReposService } from '../../../src/modules/github/services/github-repos.service';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';
import { GithubAppService } from '../../../src/modules/github/services/github-app.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('GithubReposService', () => {
  let service: GithubReposService;
  let prisma: jest.Mocked<PrismaService>;
  let oauthService: jest.Mocked<GithubOAuthService>;

  const mockOctokit = {
    repos: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({
        data: [
          { id: 1, name: 'repo1', full_name: 'owner/repo1', private: false, html_url: 'https://github.com/owner/repo1', default_branch: 'main', stargazers_count: 10, open_issues_count: 2, updated_at: '2026-01-01' },
        ],
        headers: { link: '' },
      }),
      get: jest.fn().mockResolvedValue({
        data: { id: 1, name: 'repo1', full_name: 'owner/repo1', private: false, html_url: 'https://github.com/owner/repo1', default_branch: 'main', stargazers_count: 10, open_issues_count: 2, updated_at: '2026-01-01' },
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubReposService,
        {
          provide: PrismaService,
          useValue: {
            application: { findFirst: jest.fn(), update: jest.fn() },
            githubConnection: { update: jest.fn() },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3001') },
        },
        {
          provide: GithubOAuthService,
          useValue: {
            getOctokitForTenant: jest.fn().mockResolvedValue(mockOctokit),
            getConnection: jest.fn(),
            setupWebhook: jest.fn(),
          },
        },
        {
          provide: GithubAppService,
          useValue: {
            getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit),
            isEnabled: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<GithubReposService>(GithubReposService);
    prisma = module.get(PrismaService);
    oauthService = module.get(GithubOAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listRepositories', () => {
    it('should list repositories with pagination', async () => {
      const result = await service.listRepositories('tenant-123', {} as unknown);

      expect(result.repositories).toHaveLength(1);
      expect(result.repositories[0].fullName).toBe('owner/repo1');
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getRepository', () => {
    it('should get a specific repository', async () => {
      const result = await service.getRepository('tenant-123', 'owner/repo1');

      expect(mockOctokit.repos.get).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo1' });
      expect(result.fullName).toBe('owner/repo1');
    });

    it('should throw BadRequestException for invalid format', async () => {
      await expect(service.getRepository('tenant-123', 'invalid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('linkRepository', () => {
    it('should link repository to application', async () => {
      (prisma.application.findFirst as jest.Mock).mockResolvedValue({ id: 'app-123', tenantId: 'tenant-123' });
      (prisma.application.update as jest.Mock).mockResolvedValue({ id: 'app-123', githubRepo: 'owner/repo1' });
      (oauthService.getConnection as jest.Mock).mockResolvedValue({ id: 'conn-1', repos: [] });
      (prisma.githubConnection.update as jest.Mock).mockResolvedValue({});

      const result = await service.linkRepository('tenant-123', 'app-123', 'owner/repo1');

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-123' },
        data: { githubRepo: 'owner/repo1' },
      });
    });

    it('should throw NotFoundException when app not found', async () => {
      (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.linkRepository('tenant-123', 'missing', 'owner/repo')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkRepository', () => {
    it('should unlink repository', async () => {
      (prisma.application.findFirst as jest.Mock).mockResolvedValue({ id: 'app-123' });
      (prisma.application.update as jest.Mock).mockResolvedValue({ id: 'app-123', githubRepo: null });

      const result = await service.unlinkRepository('tenant-123', 'app-123');

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-123' },
        data: { githubRepo: null },
      });
    });

    it('should throw NotFoundException when app not found', async () => {
      (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.unlinkRepository('tenant-123', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConnectedRepositories', () => {
    it('should return repos from connection', async () => {
      (oauthService.getConnection as jest.Mock).mockResolvedValue({ repos: ['owner/repo1', 'owner/repo2'] });

      const result = await service.getConnectedRepositories('tenant-123');

      expect(result).toEqual(['owner/repo1', 'owner/repo2']);
    });

    it('should return empty when no connection', async () => {
      (oauthService.getConnection as jest.Mock).mockResolvedValue(null);

      const result = await service.getConnectedRepositories('tenant-123');

      expect(result).toEqual([]);
    });
  });
});

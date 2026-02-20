import { Test, TestingModule } from '@nestjs/testing';
import { CodeInvestigationService } from '../../../src/modules/agent-v2/code-investigation.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { GithubAppService } from '../../../src/modules/github/services/github-app.service';
import { CacheService } from '../../../src/cache/cache.service';
import { Octokit } from '@octokit/rest';

describe('CodeInvestigationService', () => {
  let service: CodeInvestigationService;
  let prisma: jest.Mocked<PrismaService>;
  let githubAppService: jest.Mocked<GithubAppService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockOctokit = {
    repos: {
      getContent: jest.fn(),
      listCommits: jest.fn(),
    },
    git: {
      getTree: jest.fn(),
    },
    search: {
      code: jest.fn(),
    },
    request: jest.fn(),
  } as unknown as Octokit;

  const mockRepoCtx = {
    octokit: mockOctokit,
    owner: 'acme',
    repo: 'my-app',
    defaultBranch: 'main',
    installationId: '12345',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
  };

  beforeEach(async () => {
    const mockPrisma = {
      projectGithubConfig: {
        findUnique: jest.fn(),
      },
    };

    const mockGithubAppService = {
      getInstallationOctokit: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeInvestigationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GithubAppService, useValue: mockGithubAppService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CodeInvestigationService>(CodeInvestigationService);
    prisma = module.get(PrismaService);
    githubAppService = module.get(GithubAppService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRepoContext', () => {
    it('returns null when no ProjectGithubConfig exists', async () => {
      (prisma.projectGithubConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getRepoContext('app-123');

      expect(result).toBeNull();
      expect(prisma.projectGithubConfig.findUnique).toHaveBeenCalledWith({
        where: { applicationId: 'app-123' },
        include: { installation: true, application: true },
      });
    });

    it('returns RepoContext with octokit, owner, repo, defaultBranch', async () => {
      const mockConfig = {
        owner: 'acme',
        repo: 'my-app',
        defaultBranch: 'main',
        installation: {
          installationId: 12345,
          tenantId: 'tenant-123',
        },
        application: { id: 'app-123' },
      };
      (prisma.projectGithubConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (githubAppService.getInstallationOctokit as jest.Mock).mockResolvedValue(mockOctokit);

      const result = await service.getRepoContext('app-123');

      expect(result).not.toBeNull();
      expect(result?.owner).toBe('acme');
      expect(result?.repo).toBe('my-app');
      expect(result?.defaultBranch).toBe('main');
      expect(result?.octokit).toBe(mockOctokit);
      expect(result?.applicationId).toBe('app-123');
      expect(githubAppService.getInstallationOctokit).toHaveBeenCalledWith(12345);
    });
  });

  describe('readFile', () => {
    const fileContent = 'line1\nline2\nline3\nline4\nline5';
    const base64Content = Buffer.from(fileContent).toString('base64');

    it('reads file content via octokit.repos.getContent', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(undefined);
      (mockOctokit.repos.getContent as jest.Mock).mockResolvedValue({
        data: { content: base64Content, encoding: 'base64' },
      });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.readFile(mockRepoCtx, 'src/index.ts');

      expect(result).toBe(fileContent);
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'my-app',
        path: 'src/index.ts',
        ref: 'main',
      });
    });

    it('filters lines when startLine/endLine provided', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(undefined);
      (mockOctokit.repos.getContent as jest.Mock).mockResolvedValue({
        data: { content: base64Content, encoding: 'base64' },
      });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.readFile(mockRepoCtx, 'src/index.ts', 2, 3);

      expect(result).toBe('line2\nline3');
    });

    it('returns cached content on second call (cache hit)', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(fileContent);

      const result = await service.readFile(mockRepoCtx, 'src/index.ts');

      expect(result).toBe(fileContent);
      expect(mockOctokit.repos.getContent).not.toHaveBeenCalled();
    });

    it('returns error message when file not found (404)', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(undefined);
      const error = Object.assign(new Error('Not Found'), { status: 404 });
      (mockOctokit.repos.getContent as jest.Mock).mockRejectedValue(error);

      await expect(service.readFile(mockRepoCtx, 'missing.ts')).rejects.toThrow('Not Found');
    });
  });

  describe('listDirectory', () => {
    it('lists files at given path', async () => {
      const treeItems = [
        { path: 'src/index.ts', type: 'blob', size: 100 },
        { path: 'src/app.ts', type: 'blob', size: 200 },
      ];
      (mockOctokit.git.getTree as jest.Mock).mockResolvedValue({
        data: { tree: treeItems },
      });

      const result = await service.listDirectory(mockRepoCtx, 'src');

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('src/index.ts');
      expect(result[0].type).toBe('file');
      expect(mockOctokit.git.getTree).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'my-app',
        tree_sha: 'main:src',
        recursive: undefined,
      });
    });

    it('filters to max 2 depth levels when recursive=true', async () => {
      const treeItems = [
        { path: 'src/a.ts', type: 'blob', size: 100 },
        { path: 'src/utils/b.ts', type: 'blob', size: 100 },
        { path: 'src/deep/nested/c.ts', type: 'blob', size: 100 },
      ];
      (mockOctokit.git.getTree as jest.Mock).mockResolvedValue({
        data: { tree: treeItems },
      });

      const result = await service.listDirectory(mockRepoCtx, 'src', true);

      // depth 1 = "src/a.ts" (2 parts), depth 2 = "src/utils/b.ts" (3 parts) — both <= 2
      // depth 3 = "src/deep/nested/c.ts" (4 parts) — excluded
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.path)).not.toContain('src/deep/nested/c.ts');
    });
  });

  describe('searchCode', () => {
    it('calls octokit.search.code with repo scope', async () => {
      (mockOctokit.search.code as jest.Mock).mockResolvedValue({
        data: {
          items: [
            { path: 'src/auth.ts', text_matches: [{ fragment: 'token expired' }] },
          ],
        },
      });

      const result = await service.searchCode(mockRepoCtx, 'token expired');

      expect(mockOctokit.search.code).toHaveBeenCalledWith({
        q: 'token expired repo:acme/my-app',
        per_page: 20,
      });
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/auth.ts');
      expect(result[0].fragments).toEqual(['token expired']);
    });

    it('applies filePattern when provided', async () => {
      (mockOctokit.search.code as jest.Mock).mockResolvedValue({
        data: { items: [] },
      });

      await service.searchCode(mockRepoCtx, 'myFunction', '*.service.ts', 10);

      expect(mockOctokit.search.code).toHaveBeenCalledWith({
        q: 'myFunction repo:acme/my-app path:*.service.ts',
        per_page: 10,
      });
    });

    it('limits results to maxResults', async () => {
      (mockOctokit.search.code as jest.Mock).mockResolvedValue({
        data: { items: [] },
      });

      await service.searchCode(mockRepoCtx, 'query', undefined, 5);

      expect(mockOctokit.search.code).toHaveBeenCalledWith({
        q: 'query repo:acme/my-app',
        per_page: 5,
      });
    });
  });

  describe('getRepoStructure', () => {
    it('returns cached structure when available', async () => {
      const cachedStructure = '📁 src\n  📄 index.ts';
      (cacheService.get as jest.Mock).mockResolvedValue(cachedStructure);

      const result = await service.getRepoStructure(mockRepoCtx);

      expect(result).toBe(cachedStructure);
      expect(mockOctokit.git.getTree).not.toHaveBeenCalled();
    });

    it('excludes node_modules, dist, .git by default', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(undefined);
      const treeItems = [
        { path: 'src/index.ts', type: 'blob' },
        { path: 'node_modules/lodash/index.js', type: 'blob' },
        { path: 'dist/bundle.js', type: 'blob' },
        { path: '.git/config', type: 'blob' },
      ];
      (mockOctokit.git.getTree as jest.Mock).mockResolvedValue({
        data: { tree: treeItems },
      });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getRepoStructure(mockRepoCtx);

      expect(result).toContain('index.ts');
      expect(result).not.toContain('lodash');
      expect(result).not.toContain('bundle.js');
    });

    it('respects maxDepth parameter', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(undefined);
      const treeItems = [
        { path: 'src/index.ts', type: 'blob' },
        { path: 'src/utils/helper.ts', type: 'blob' },
        { path: 'src/modules/auth/auth.service.ts', type: 'blob' },
      ];
      (mockOctokit.git.getTree as jest.Mock).mockResolvedValue({
        data: { tree: treeItems },
      });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getRepoStructure(mockRepoCtx, 2);

      // maxDepth=2 — path with 3 parts (src/index.ts) ok, 3 parts (src/utils/helper.ts) ok,
      // 4 parts (src/modules/auth/auth.service.ts) excluded
      expect(result).toContain('index.ts');
      expect(result).toContain('helper.ts');
      expect(result).not.toContain('auth.service.ts');
    });
  });

  describe('getFileHistory', () => {
    it('returns commits for given file path', async () => {
      const mockCommits = [
        {
          sha: 'abc1234567890',
          commit: {
            message: 'fix: token expiry\n\nDetailed description',
            author: { name: 'Alice', date: '2024-01-01T00:00:00Z' },
          },
        },
        {
          sha: 'def9876543210',
          commit: {
            message: 'feat: add auth',
            author: { name: 'Bob', date: '2024-01-02T00:00:00Z' },
          },
        },
      ];
      (mockOctokit.repos.listCommits as jest.Mock).mockResolvedValue({
        data: mockCommits,
      });

      const result = await service.getFileHistory(mockRepoCtx, 'src/auth.ts');

      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('abc1234');
      expect(result[0].message).toBe('fix: token expiry');
      expect(result[0].author).toBe('Alice');
    });

    it('limits to requested number of commits', async () => {
      (mockOctokit.repos.listCommits as jest.Mock).mockResolvedValue({
        data: [],
      });

      await service.getFileHistory(mockRepoCtx, 'src/auth.ts', 3);

      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'my-app',
        path: 'src/auth.ts',
        per_page: 3,
      });
    });
  });
});

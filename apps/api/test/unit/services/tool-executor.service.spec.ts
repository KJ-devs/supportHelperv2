import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutorService, ToolExecutionContext } from '../../../src/modules/agent-v2/tool-executor.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CodeInvestigationService, RepoContext } from '../../../src/modules/agent-v2/code-investigation.service';
import { CodebaseSearchService } from '../../../src/modules/codebase-index/services/codebase-search.service';
import { Octokit } from '@octokit/rest';

describe('ToolExecutorService', () => {
  let service: ToolExecutorService;
  let prisma: jest.Mocked<PrismaService>;
  let codeInvestigation: jest.Mocked<CodeInvestigationService>;
  let codebaseSearch: jest.Mocked<CodebaseSearchService>;

  const mockRepoCtx: RepoContext = {
    octokit: {} as Octokit,
    owner: 'acme',
    repo: 'my-app',
    defaultBranch: 'main',
    installationId: '12345',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
  };

  const mockContext: ToolExecutionContext = {
    repoCtx: mockRepoCtx,
    ticket: {
      id: 'ticket-123',
      tenantId: 'tenant-123',
      applicationId: 'app-123',
      title: 'Bug report',
      description: 'Something broke',
      status: 'open',
    },
    tenantId: 'tenant-123',
    applicationId: 'app-123',
  };

  const contextNoRepo: ToolExecutionContext = {
    ...mockContext,
    repoCtx: null,
  };

  beforeEach(async () => {
    const mockPrisma = {
      ticket: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      agentSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const mockCodeInvestigation = {
      readFile: jest.fn(),
      listDirectory: jest.fn(),
      searchCode: jest.fn(),
      getRepoStructure: jest.fn(),
      getFileHistory: jest.fn(),
      getFileBlame: jest.fn(),
    };

    const mockCodebaseSearch = {
      findRelevantFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolExecutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CodeInvestigationService, useValue: mockCodeInvestigation },
        { provide: CodebaseSearchService, useValue: mockCodebaseSearch },
      ],
    }).compile();

    service = module.get<ToolExecutorService>(ToolExecutorService);
    prisma = module.get(PrismaService);
    codeInvestigation = module.get(CodeInvestigationService);
    codebaseSearch = module.get(CodebaseSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('delegates read_file to CodeInvestigationService', async () => {
      (codeInvestigation.readFile as jest.Mock).mockResolvedValue('file content here');

      const result = await service.execute(
        'read_file',
        { file_path: 'src/auth.ts' },
        mockContext,
      );

      expect(codeInvestigation.readFile).toHaveBeenCalledWith(
        mockRepoCtx,
        'src/auth.ts',
        undefined,
        undefined,
      );
      expect(result).toBe('file content here');
    });

    it('delegates list_directory to CodeInvestigationService', async () => {
      const mockEntries = [{ path: 'src/index.ts', type: 'file' }];
      (codeInvestigation.listDirectory as jest.Mock).mockResolvedValue(mockEntries);

      const result = await service.execute(
        'list_directory',
        { path: 'src', recursive: true },
        mockContext,
      );

      expect(codeInvestigation.listDirectory).toHaveBeenCalledWith(mockRepoCtx, 'src', true);
      expect(result).toEqual(mockEntries);
    });

    it('delegates search_code to CodeInvestigationService', async () => {
      const mockHits = [{ filePath: 'src/auth.ts', matchCount: 1, fragments: ['token'] }];
      (codeInvestigation.searchCode as jest.Mock).mockResolvedValue(mockHits);

      const result = await service.execute(
        'search_code',
        { query: 'token', file_pattern: '*.ts', max_results: 5 },
        mockContext,
      );

      expect(codeInvestigation.searchCode).toHaveBeenCalledWith(
        mockRepoCtx,
        'token',
        '*.ts',
        5,
      );
      expect(result).toEqual(mockHits);
    });

    it('delegates get_repo_structure to CodeInvestigationService', async () => {
      (codeInvestigation.getRepoStructure as jest.Mock).mockResolvedValue('📁 src');

      const result = await service.execute(
        'get_repo_structure',
        { max_depth: 2, exclude_patterns: ['*.log'] },
        mockContext,
      );

      expect(codeInvestigation.getRepoStructure).toHaveBeenCalledWith(
        mockRepoCtx,
        2,
        ['*.log'],
      );
      expect(result).toBe('📁 src');
    });

    it('delegates get_file_history to CodeInvestigationService', async () => {
      const mockHistory = [{ sha: 'abc1234', message: 'fix bug', author: 'Alice', date: '2024-01-01' }];
      (codeInvestigation.getFileHistory as jest.Mock).mockResolvedValue(mockHistory);

      const result = await service.execute(
        'get_file_history',
        { file_path: 'src/auth.ts', limit: 3 },
        mockContext,
      );

      expect(codeInvestigation.getFileHistory).toHaveBeenCalledWith(mockRepoCtx, 'src/auth.ts', 3);
      expect(result).toEqual(mockHistory);
    });

    it('delegates search_codebase_semantic to CodebaseSearchService', async () => {
      const mockResults = [{ filePath: 'src/auth.ts', score: 0.95 }];
      (codebaseSearch.findRelevantFiles as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.execute(
        'search_codebase_semantic',
        { query: 'authentication logic', limit: 5 },
        mockContext,
      );

      expect(codebaseSearch.findRelevantFiles).toHaveBeenCalledWith('app-123', 'authentication logic', 5);
      expect(result).toEqual(mockResults);
    });

    it('delegates get_ticket_details to PrismaService', async () => {
      const mockTicket = { id: 'ticket-456', title: 'Other bug', status: 'open' };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const result = await service.execute(
        'get_ticket_details',
        { ticket_id: 'ticket-456' },
        mockContext,
      );

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-456', tenantId: 'tenant-123' },
        }),
      );
      expect(result).toEqual(mockTicket);
    });

    it('returns NO_REPO_ERROR when repoCtx is null and code tool called', async () => {
      const result = await service.execute('read_file', { file_path: 'src/auth.ts' }, contextNoRepo);

      expect(result).toEqual({
        error: 'No repository connected to this application. Connect a GitHub repo in Settings > GitHub.',
      });
      expect(codeInvestigation.readFile).not.toHaveBeenCalled();
    });

    it('returns NO_REPO_ERROR for list_directory when no repo', async () => {
      const result = await service.execute('list_directory', { path: 'src' }, contextNoRepo);
      expect(result).toEqual({ error: expect.stringContaining('No repository connected') });
    });

    it('returns NO_REPO_ERROR for search_code when no repo', async () => {
      const result = await service.execute('search_code', { query: 'foo' }, contextNoRepo);
      expect(result).toEqual({ error: expect.stringContaining('No repository connected') });
    });

    it('returns NO_REPO_ERROR for get_repo_structure when no repo', async () => {
      const result = await service.execute('get_repo_structure', {}, contextNoRepo);
      expect(result).toEqual({ error: expect.stringContaining('No repository connected') });
    });

    it('returns NO_REPO_ERROR for get_file_history when no repo', async () => {
      const result = await service.execute('get_file_history', { file_path: 'src/auth.ts' }, contextNoRepo);
      expect(result).toEqual({ error: expect.stringContaining('No repository connected') });
    });

    it('returns { error: message } on exception (does not throw)', async () => {
      (codeInvestigation.readFile as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const result = await service.execute('read_file', { file_path: 'src/auth.ts' }, mockContext);

      expect(result).toEqual({ error: 'Network timeout' });
    });

    it('returns update_diagnosis result without calling other services', async () => {
      const result = await service.execute(
        'update_diagnosis',
        { root_cause: 'Null pointer in auth', confidence: 0.9 },
        mockContext,
      );

      expect(result).toEqual({
        status: 'diagnosis_updated',
        rootCause: 'Null pointer in auth',
        confidence: 0.9,
      });
    });
  });
});

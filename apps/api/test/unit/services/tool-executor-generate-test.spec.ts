jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  ToolExecutorService,
  ToolExecutionContext,
} from '../../../src/modules/agent-v2/tool-executor.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  CodeInvestigationService,
  RepoContext,
} from '../../../src/modules/agent-v2/code-investigation.service';
import { CodebaseSearchService } from '../../../src/modules/codebase-index/services/codebase-search.service';
import type { Octokit } from '@octokit/rest';

describe('ToolExecutorService — generate_test', () => {
  let service: ToolExecutorService;
  let codeInvestigation: jest.Mocked<CodeInvestigationService>;

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
      writeFile: jest.fn(),
      editFile: jest.fn(),
      createBranch: jest.fn(),
      createPullRequest: jest.fn(),
      findOpenPR: jest.fn(),
      addPRComment: jest.fn(),
      getRepoContextByName: jest.fn(),
      getAllRepoContexts: jest.fn(),
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
    codeInvestigation = module.get(CodeInvestigationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate_test tool', () => {
    const validInput = {
      branch: 'fix/ticket-123-null-auth',
      test_file_path: 'src/auth/__tests__/auth.service.test.ts',
      test_content: "describe('auth', () => { it('should work', () => {}); });",
      related_fix_file: 'src/auth/auth.service.ts',
    };

    it('calls codeInvestigation.writeFile with correct args', async () => {
      (codeInvestigation.writeFile as jest.Mock).mockResolvedValue({
        sha: 'abc1234',
        url: 'https://github.com/acme/my-app/blob/abc1234/src/auth/__tests__/auth.service.test.ts',
      });

      await service.execute('generate_test', validInput, mockContext);

      expect(codeInvestigation.writeFile).toHaveBeenCalledWith(
        mockRepoCtx,
        'fix/ticket-123-null-auth',
        'src/auth/__tests__/auth.service.test.ts',
        "describe('auth', () => { it('should work', () => {}); });",
        'test: add test for fix in src/auth/auth.service.ts'
      );
    });

    it('returns the result from writeFile', async () => {
      const writeResult = {
        sha: 'def5678',
        url: 'https://github.com/acme/my-app/blob/def5678/src/auth/__tests__/auth.service.test.ts',
      };
      (codeInvestigation.writeFile as jest.Mock).mockResolvedValue(writeResult);

      const result = await service.execute('generate_test', validInput, mockContext);

      expect(result).toEqual(writeResult);
    });

    it('constructs commit message from related_fix_file', async () => {
      (codeInvestigation.writeFile as jest.Mock).mockResolvedValue({ sha: 'abc' });

      await service.execute(
        'generate_test',
        {
          ...validInput,
          related_fix_file: 'src/payments/stripe.service.ts',
        },
        mockContext
      );

      expect(codeInvestigation.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'test: add test for fix in src/payments/stripe.service.ts'
      );
    });

    it('returns NO_REPO_ERROR when repoCtx is null', async () => {
      const result = await service.execute('generate_test', validInput, contextNoRepo);

      expect(result).toEqual({
        error:
          'No repository connected to this application. Connect a GitHub repo in Settings > GitHub.',
      });
      expect(codeInvestigation.writeFile).not.toHaveBeenCalled();
    });

    it('rejects denied path .env.test', async () => {
      const result = await service.execute(
        'generate_test',
        {
          ...validInput,
          test_file_path: '.env.test',
        },
        mockContext
      );

      expect(result).toEqual({
        error: `Writing to ".env.test" is not allowed (protected path)`,
      });
      expect(codeInvestigation.writeFile).not.toHaveBeenCalled();
    });

    it('rejects denied path starting with .env (e.g. .env.production)', async () => {
      const result = await service.execute(
        'generate_test',
        {
          ...validInput,
          test_file_path: '.env.production',
        },
        mockContext
      );

      expect(result).toEqual({
        error: expect.stringContaining('not allowed (protected path)'),
      });
      expect(codeInvestigation.writeFile).not.toHaveBeenCalled();
    });

    it('rejects denied path jest.config.js', async () => {
      const result = await service.execute(
        'generate_test',
        {
          ...validInput,
          test_file_path: 'jest.config.js',
        },
        mockContext
      );

      expect(result).toEqual({
        error: expect.stringContaining('not allowed (protected path)'),
      });
      expect(codeInvestigation.writeFile).not.toHaveBeenCalled();
    });

    it('rejects denied path package.json', async () => {
      const result = await service.execute(
        'generate_test',
        {
          ...validInput,
          test_file_path: 'package.json',
        },
        mockContext
      );

      expect(result).toEqual({
        error: expect.stringContaining('not allowed (protected path)'),
      });
      expect(codeInvestigation.writeFile).not.toHaveBeenCalled();
    });

    it('allows valid test file paths that are not denied', async () => {
      (codeInvestigation.writeFile as jest.Mock).mockResolvedValue({ sha: 'xyz' });

      // These should all pass the denial check
      const allowedPaths = [
        'src/auth/__tests__/auth.spec.ts',
        'test/unit/auth.test.ts',
        'packages/shared/src/__tests__/utils.test.ts',
      ];

      for (const test_file_path of allowedPaths) {
        jest.clearAllMocks();
        const result = await service.execute(
          'generate_test',
          { ...validInput, test_file_path },
          mockContext
        );
        expect(result).not.toHaveProperty('error');
        expect(codeInvestigation.writeFile).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          test_file_path,
          expect.anything(),
          expect.anything()
        );
      }
    });

    it('returns error object when writeFile throws (does not propagate)', async () => {
      (codeInvestigation.writeFile as jest.Mock).mockRejectedValue(
        new Error('Branch not found: fix/ticket-123-null-auth')
      );

      const result = await service.execute('generate_test', validInput, mockContext);

      expect(result).toEqual({ error: 'Branch not found: fix/ticket-123-null-auth' });
    });
  });
});

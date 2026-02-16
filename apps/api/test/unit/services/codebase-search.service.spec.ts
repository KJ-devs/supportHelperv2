import { Test, TestingModule } from '@nestjs/testing';
import { CodebaseSearchService } from '../../../src/modules/codebase-index/services/codebase-search.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';

describe('CodebaseSearchService', () => {
  let service: CodebaseSearchService;
  let prisma: PrismaService;
  let aiService: AIService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    ticket: {
      findUnique: jest.fn(),
    },
    codebaseIndexStatus: {
      findUnique: jest.fn(),
    },
  };

  const mockAIService = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodebaseSearchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AIService,
          useValue: mockAIService,
        },
      ],
    }).compile();

    service = module.get<CodebaseSearchService>(CodebaseSearchService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AIService>(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findRelevantFiles', () => {
    it('should return search results sorted by similarity', async () => {
      const appId = 'app-123';
      const query = 'authentication logic';
      const embedding = [0.1, 0.2, 0.3];
      const dbResults = [
        {
          file_path: 'src/auth/auth.service.ts',
          chunk_index: 0,
          content: 'export class AuthService { authenticate() {} }',
          language: 'typescript',
          metadata: { lines: 50 },
          distance: 0.12,
        },
        {
          file_path: 'src/auth/jwt.strategy.ts',
          chunk_index: 1,
          content: 'export class JwtStrategy extends PassportStrategy {}',
          language: 'typescript',
          metadata: { lines: 30 },
          distance: 0.18,
        },
      ];

      mockAIService.generateEmbedding.mockResolvedValue(embedding);
      mockPrismaService.$queryRaw.mockResolvedValue(dbResults);

      const results = await service.findRelevantFiles(appId, query, 10);

      expect(results).toEqual([
        {
          filePath: 'src/auth/auth.service.ts',
          chunkIndex: 0,
          content: 'export class AuthService { authenticate() {} }',
          language: 'typescript',
          distance: 0.12,
          metadata: { lines: 50 },
        },
        {
          filePath: 'src/auth/jwt.strategy.ts',
          chunkIndex: 1,
          content: 'export class JwtStrategy extends PassportStrategy {}',
          language: 'typescript',
          distance: 0.18,
          metadata: { lines: 30 },
        },
      ]);
      expect(aiService.generateEmbedding).toHaveBeenCalledWith(query);
    });

    it('should return empty array when embedding generation fails', async () => {
      mockAIService.generateEmbedding.mockResolvedValue([]);

      const results = await service.findRelevantFiles('app-123', 'query', 5);

      expect(results).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should handle results with null metadata', async () => {
      const embedding = [0.1, 0.2];
      const dbResults = [
        {
          file_path: 'file.ts',
          chunk_index: 0,
          content: 'code',
          language: 'typescript',
          metadata: null,
          distance: 0.5,
        },
      ];

      mockAIService.generateEmbedding.mockResolvedValue(embedding);
      mockPrismaService.$queryRaw.mockResolvedValue(dbResults);

      const results = await service.findRelevantFiles('app-123', 'test', 10);

      expect(results[0].metadata).toEqual({});
    });
  });

  describe('findRelevantForTicket', () => {
    it('should search using ticket content when codebase is indexed', async () => {
      const ticketId = 'ticket-123';
      const ticket = {
        applicationId: 'app-123',
        title: 'Login fails with JWT',
        description: 'Users cannot login',
        aiSummary: 'Authentication issue with JWT tokens',
      };
      const indexStatus = {
        applicationId: 'app-123',
        status: 'indexed',
      };
      const embedding = [0.1, 0.2];
      const dbResults = [
        {
          file_path: 'src/auth/auth.service.ts',
          chunk_index: 0,
          content: 'JWT validation logic',
          language: 'typescript',
          metadata: {},
          distance: 0.1,
        },
      ];

      mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);
      mockPrismaService.codebaseIndexStatus.findUnique.mockResolvedValue(indexStatus);
      mockAIService.generateEmbedding.mockResolvedValue(embedding);
      mockPrismaService.$queryRaw.mockResolvedValue(dbResults);

      const results = await service.findRelevantForTicket(ticketId, 10);

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('src/auth/auth.service.ts');
      expect(aiService.generateEmbedding).toHaveBeenCalledWith(
        'Login fails with JWT Users cannot login Authentication issue with JWT tokens',
      );
    });

    it('should return empty array when ticket has no application', async () => {
      const ticketId = 'ticket-456';
      const ticket = {
        applicationId: null,
        title: 'Test ticket',
      };

      mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);

      const results = await service.findRelevantForTicket(ticketId, 10);

      expect(results).toEqual([]);
      expect(prisma.codebaseIndexStatus.findUnique).not.toHaveBeenCalled();
    });

    it('should return empty array when ticket not found', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(null);

      const results = await service.findRelevantForTicket('non-existent', 10);

      expect(results).toEqual([]);
    });

    it('should return empty array when codebase not indexed', async () => {
      const ticketId = 'ticket-789';
      const ticket = {
        applicationId: 'app-789',
        title: 'Test',
        description: 'Desc',
      };

      mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);
      mockPrismaService.codebaseIndexStatus.findUnique.mockResolvedValue(null);

      const results = await service.findRelevantForTicket(ticketId, 10);

      expect(results).toEqual([]);
    });

    it('should return empty array when codebase status is not indexed', async () => {
      const ticketId = 'ticket-999';
      const ticket = {
        applicationId: 'app-999',
        title: 'Test',
      };
      const indexStatus = {
        applicationId: 'app-999',
        status: 'indexing',
      };

      mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);
      mockPrismaService.codebaseIndexStatus.findUnique.mockResolvedValue(indexStatus);

      const results = await service.findRelevantForTicket(ticketId, 10);

      expect(results).toEqual([]);
    });

    it('should return empty array when ticket has no content', async () => {
      const ticketId = 'ticket-empty';
      const ticket = {
        applicationId: 'app-empty',
        title: null,
        description: null,
        aiSummary: null,
      };
      const indexStatus = {
        applicationId: 'app-empty',
        status: 'indexed',
      };

      mockPrismaService.ticket.findUnique.mockResolvedValue(ticket);
      mockPrismaService.codebaseIndexStatus.findUnique.mockResolvedValue(indexStatus);

      const results = await service.findRelevantForTicket(ticketId, 10);

      expect(results).toEqual([]);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CodebaseIndexController } from '../../../src/modules/codebase-index/codebase-index.controller';
import { CodebaseIndexerService } from '../../../src/modules/codebase-index/services/codebase-indexer.service';
import { CodebaseSearchService } from '../../../src/modules/codebase-index/services/codebase-search.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Mock @octokit/rest to avoid ESM import issues
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

describe('CodebaseIndexController', () => {
  let controller: CodebaseIndexController;
  let indexerService: CodebaseIndexerService;
  let searchService: CodebaseSearchService;
  let prisma: PrismaService;

  const mockIndexerService = {
    queueFullIndex: jest.fn(),
    queueIncrementalIndex: jest.fn(),
    getStatus: jest.fn(),
  };

  const mockSearchService = {
    findRelevantFiles: jest.fn(),
  };

  const mockPrismaService = {
    application: {
      findFirst: jest.fn(),
    },
  };

  const mockRequest = { user: { tenantId: 'tenant-123' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodebaseIndexController],
      providers: [
        {
          provide: CodebaseIndexerService,
          useValue: mockIndexerService,
        },
        {
          provide: CodebaseSearchService,
          useValue: mockSearchService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<CodebaseIndexController>(CodebaseIndexController);
    indexerService = module.get<CodebaseIndexerService>(CodebaseIndexerService);
    searchService = module.get<CodebaseSearchService>(CodebaseSearchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reindex', () => {
    it('should queue full reindex when no commit SHA provided', async () => {
      const appId = 'app-123';
      const dto = {};

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockIndexerService.queueFullIndex.mockResolvedValue('job-123');

      const result = await controller.reindex(appId, dto, mockRequest);

      expect(result).toEqual({ jobId: 'job-123', message: 'Indexing queued' });
      expect(indexerService.queueFullIndex).toHaveBeenCalledWith(appId, 'tenant-123');
      expect(indexerService.queueIncrementalIndex).not.toHaveBeenCalled();
    });

    it('should queue incremental reindex when commit SHA provided', async () => {
      const appId = 'app-456';
      const dto = { sinceCommitSha: 'abc123def' };

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockIndexerService.queueIncrementalIndex.mockResolvedValue('job-456');

      const result = await controller.reindex(appId, dto, mockRequest);

      expect(result).toEqual({ jobId: 'job-456', message: 'Indexing queued' });
      expect(indexerService.queueIncrementalIndex).toHaveBeenCalledWith(appId, 'tenant-123', 'abc123def');
      expect(indexerService.queueFullIndex).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when application not found', async () => {
      const appId = 'non-existent';
      const dto = {};

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.reindex(appId, dto, mockRequest)).rejects.toThrow(NotFoundException);
      await expect(controller.reindex(appId, dto, mockRequest)).rejects.toThrow('Application not found');
    });

    it('should throw NotFoundException when application belongs to different tenant', async () => {
      const appId = 'app-789';
      const dto = {};

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.reindex(appId, dto, mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatus', () => {
    it('should return indexing status when application exists', async () => {
      const appId = 'app-123';
      const status = {
        applicationId: appId,
        status: 'indexed',
        lastIndexedAt: new Date(),
        lastCommitSha: 'abc123',
        totalFiles: 100,
        totalChunks: 500,
      };

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockIndexerService.getStatus.mockResolvedValue(status);

      const result = await controller.getStatus(appId, mockRequest);

      expect(result).toEqual(status);
      expect(indexerService.getStatus).toHaveBeenCalledWith(appId);
    });

    it('should return not_indexed when no status exists', async () => {
      const appId = 'app-456';

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockIndexerService.getStatus.mockResolvedValue(null);

      const result = await controller.getStatus(appId, mockRequest);

      expect(result).toEqual({ status: 'not_indexed' });
    });

    it('should throw NotFoundException when application not found', async () => {
      const appId = 'non-existent';

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.getStatus(appId, mockRequest)).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return search results for valid application', async () => {
      const appId = 'app-123';
      const dto = { query: 'authentication function', limit: 5 };
      const results = [
        {
          filePath: 'src/auth/auth.service.ts',
          chunkIndex: 0,
          content: 'export class AuthService { ... }',
          language: 'typescript',
          distance: 0.15,
          metadata: {},
        },
      ];

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockSearchService.findRelevantFiles.mockResolvedValue(results);

      const result = await controller.search(appId, dto, mockRequest);

      expect(result).toEqual(results);
      expect(searchService.findRelevantFiles).toHaveBeenCalledWith(appId, dto.query, dto.limit);
    });

    it('should use default limit when not provided', async () => {
      const appId = 'app-456';
      const dto = { query: 'database connection' };

      mockPrismaService.application.findFirst.mockResolvedValue({
        id: appId,
        tenantId: 'tenant-123',
      });
      mockSearchService.findRelevantFiles.mockResolvedValue([]);

      await controller.search(appId, dto, mockRequest);

      expect(searchService.findRelevantFiles).toHaveBeenCalledWith(appId, dto.query, undefined);
    });

    it('should throw NotFoundException when application not found', async () => {
      const appId = 'non-existent';
      const dto = { query: 'test' };

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.search(appId, dto, mockRequest)).rejects.toThrow(NotFoundException);
    });
  });
});

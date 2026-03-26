import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AiPromptConfigService } from '../../../src/modules/ai-config/ai-prompt-config.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CacheService } from '../../../src/cache';

describe('AiPromptConfigService.computeConfigHash', () => {
  let service: AiPromptConfigService;
  let prisma: { aiPromptConfig: { findUnique: jest.Mock; upsert: jest.Mock } };

  const mockCacheService = {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest
      .fn()
      .mockImplementation((_key: string, _ttl: number, factory: () => unknown) => factory()),
  };

  const baseConfig = {
    id: 'config-1',
    tenantId: 'tenant-123',
    productDescription: 'A support platform',
    globalInstructions: 'Be concise.',
    triageInstructions: 'Classify quickly.',
    n1Instructions: null,
    analysisInstructions: 'Look at the stack trace.',
    responseLanguage: 'en',
    enableTriage: true,
    enableN1: true,
    enableN2: true,
    triageTemperature: 0.1,
    n1Temperature: 0.1,
    analysisTemperature: 0.3,
    maxIterationsN2: 15,
    timeoutN2: 120,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      aiPromptConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AiPromptConfigService>(AiPromptConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeConfigHash', () => {
    it('returns a SHA-256 hex string when config exists', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(baseConfig);

      const hash = await service.computeConfigHash('tenant-123');

      expect(hash).not.toBeNull();
      // SHA-256 produces a 64-character hex string
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns null when no config found', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(null);

      const hash = await service.computeConfigHash('tenant-123');

      expect(hash).toBeNull();
    });

    it('same config always produces the same hash', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(baseConfig);

      const hash1 = await service.computeConfigHash('tenant-123');
      const hash2 = await service.computeConfigHash('tenant-123');

      expect(hash1).toBe(hash2);
    });

    it('different globalInstructions produce different hashes', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(baseConfig);
      const hash1 = await service.computeConfigHash('tenant-123');

      prisma.aiPromptConfig.findUnique.mockResolvedValue({
        ...baseConfig,
        globalInstructions: 'Be verbose and detailed.',
      });
      const hash2 = await service.computeConfigHash('tenant-123');

      expect(hash1).not.toBe(hash2);
    });

    it('different triageInstructions produce different hashes', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(baseConfig);
      const hash1 = await service.computeConfigHash('tenant-123');

      prisma.aiPromptConfig.findUnique.mockResolvedValue({
        ...baseConfig,
        triageInstructions: 'Take your time with classification.',
      });
      const hash2 = await service.computeConfigHash('tenant-123');

      expect(hash1).not.toBe(hash2);
    });

    it('different productDescription produces different hashes', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(baseConfig);
      const hash1 = await service.computeConfigHash('tenant-123');

      prisma.aiPromptConfig.findUnique.mockResolvedValue({
        ...baseConfig,
        productDescription: 'An enterprise platform',
      });
      const hash2 = await service.computeConfigHash('tenant-123');

      expect(hash1).not.toBe(hash2);
    });

    it('hash covers exactly the 5 instruction fields (not temperature/flags)', async () => {
      // Verify hash matches what we expect from manual computation
      const config = {
        ...baseConfig,
        productDescription: 'Test',
        globalInstructions: 'Global',
        triageInstructions: 'Triage',
        n1Instructions: null,
        analysisInstructions: 'Analysis',
      };
      prisma.aiPromptConfig.findUnique.mockResolvedValue(config);

      const hash = await service.computeConfigHash('tenant-123');

      const expectedPayload = JSON.stringify({
        productDescription: 'Test',
        globalInstructions: 'Global',
        triageInstructions: 'Triage',
        n1Instructions: null,
        analysisInstructions: 'Analysis',
      });
      const expectedHash = createHash('sha256').update(expectedPayload).digest('hex');

      expect(hash).toBe(expectedHash);
    });

    it('returns null on database error (does not throw)', async () => {
      prisma.aiPromptConfig.findUnique.mockRejectedValue(new Error('Connection refused'));

      const hash = await service.computeConfigHash('tenant-123');

      expect(hash).toBeNull();
    });

    it('queries by tenantId', async () => {
      prisma.aiPromptConfig.findUnique.mockResolvedValue(null);

      await service.computeConfigHash('tenant-xyz');

      expect(prisma.aiPromptConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-xyz' },
      });
    });
  });
});

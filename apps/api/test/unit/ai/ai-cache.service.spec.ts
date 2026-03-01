import { Test, TestingModule } from '@nestjs/testing';
import { AiCacheService, AI_CACHE_TTL } from '../../../src/ai/ai-cache.service';
import { CacheService } from '../../../src/cache/cache.service';

describe('AiCacheService', () => {
  let service: AiCacheService;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getOrSet: jest.fn(),
      invalidateByPrefix: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        hits: 5,
        misses: 3,
        hitRate: '62.5%',
        total: 8,
      }),
      hashFilters: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCacheService,
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AiCacheService>(AiCacheService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildKey', () => {
    it('should generate a deterministic cache key', () => {
      const key1 = service.buildKey({
        operation: 'classifyIssue',
        prompt: 'test prompt',
        systemPrompt: 'system',
        temperature: 0.1,
      });
      const key2 = service.buildKey({
        operation: 'classifyIssue',
        prompt: 'test prompt',
        systemPrompt: 'system',
        temperature: 0.1,
      });
      expect(key1).toBe(key2);
      expect(key1).toContain('ai:completion:classifyIssue:');
    });

    it('should generate different keys for different prompts', () => {
      const key1 = service.buildKey({ operation: 'classify', prompt: 'prompt A' });
      const key2 = service.buildKey({ operation: 'classify', prompt: 'prompt B' });
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different temperatures', () => {
      const key1 = service.buildKey({ operation: 'classify', prompt: 'same', temperature: 0.1 });
      const key2 = service.buildKey({ operation: 'classify', prompt: 'same', temperature: 0.7 });
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different operations', () => {
      const key1 = service.buildKey({ operation: 'analyzeVideo', prompt: 'same' });
      const key2 = service.buildKey({ operation: 'classifyIssue', prompt: 'same' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value on cache hit (no AI call)', async () => {
      cacheService.getOrSet.mockResolvedValue('cached-result');
      const factory = jest.fn().mockResolvedValue('fresh-result');

      const result = await service.getOrSet('key', 3600, factory);

      expect(result).toBe('cached-result');
      expect(cacheService.getOrSet).toHaveBeenCalledWith('key', 3600, factory);
    });

    it('should call factory on cache miss', async () => {
      const factory = jest.fn().mockResolvedValue('fresh-result');
      cacheService.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());

      const result = await service.getOrSet('key', 3600, factory);

      expect(result).toBe('fresh-result');
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('should delete a specific cache key', async () => {
      await service.invalidate('ai:completion:test:abc');
      expect(cacheService.del).toHaveBeenCalledWith('ai:completion:test:abc');
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all AI completion caches', async () => {
      await service.invalidateAll();
      expect(cacheService.invalidateByPrefix).toHaveBeenCalledWith('ai:completion:');
    });
  });

  describe('AI_CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(AI_CACHE_TTL.ANALYZE_VIDEO).toBe(3600);      // 1 hour
      expect(AI_CACHE_TTL.PROCESS_DESCRIPTION).toBe(3600); // 1 hour
      expect(AI_CACHE_TTL.CLASSIFY_ISSUE).toBe(14400);     // 4 hours
      expect(AI_CACHE_TTL.WORKER_CLASSIFY).toBe(14400);    // 4 hours
    });
  });
});

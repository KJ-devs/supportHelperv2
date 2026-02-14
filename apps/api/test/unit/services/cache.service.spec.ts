import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../../../src/cache/cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockCache: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return cached value on hit', async () => {
      mockCache.get.mockResolvedValue({ data: 'test' });

      const result = await service.get<{ data: string }>('my-key');

      expect(result).toEqual({ data: 'test' });
      expect(mockCache.get).toHaveBeenCalledWith('my-key');
    });

    it('should return undefined on cache miss', async () => {
      mockCache.get.mockResolvedValue(undefined);

      const result = await service.get('missing-key');

      expect(result).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await service.get('error-key');

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set a value with TTL in milliseconds', async () => {
      mockCache.set.mockResolvedValue(undefined);

      await service.set('my-key', { data: 'test' }, 300);

      expect(mockCache.set).toHaveBeenCalledWith('my-key', { data: 'test' }, 300000);
    });

    it('should not throw on error', async () => {
      mockCache.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.set('key', 'val', 60)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockCache.del.mockResolvedValue(undefined);

      await service.del('my-key');

      expect(mockCache.del).toHaveBeenCalledWith('my-key');
    });

    it('should not throw on error', async () => {
      mockCache.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.del('key')).resolves.toBeUndefined();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value without calling factory', async () => {
      mockCache.get.mockResolvedValue('cached-value');
      const factory = jest.fn();

      const result = await service.getOrSet('key', 300, factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      mockCache.get.mockResolvedValue(undefined);
      mockCache.set.mockResolvedValue(undefined);
      const factory = jest.fn().mockResolvedValue('fresh-value');

      const result = await service.getOrSet('key', 300, factory);

      expect(result).toBe('fresh-value');
      expect(factory).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('key', 'fresh-value', 300000);
    });
  });

  describe('hashFilters', () => {
    it('should produce deterministic hashes', () => {
      const hash1 = service.hashFilters({ page: 1, status: 'open' });
      const hash2 = service.hashFilters({ page: 1, status: 'open' });

      expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of key order', () => {
      const hash1 = service.hashFilters({ page: 1, status: 'open' });
      const hash2 = service.hashFilters({ status: 'open', page: 1 });

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different filters', () => {
      const hash1 = service.hashFilters({ page: 1 });
      const hash2 = service.hashFilters({ page: 2 });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getMetrics', () => {
    it('should track hits and misses', async () => {
      mockCache.get.mockResolvedValueOnce('hit');
      mockCache.get.mockResolvedValueOnce(undefined);
      mockCache.get.mockResolvedValueOnce('hit');

      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      const metrics = service.getMetrics();

      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.total).toBe(3);
      expect(metrics.hitRate).toBe('66.7%');
    });
  });
});

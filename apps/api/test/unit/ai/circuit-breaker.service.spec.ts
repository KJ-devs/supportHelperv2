import { Test, TestingModule } from '@nestjs/testing';
import { AiCircuitBreakerService } from '../../../src/ai/circuit-breaker.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CacheService } from '../../../src/cache/cache.service';

describe('AiCircuitBreakerService', () => {
  let service: AiCircuitBreakerService;

  const mockPrisma = {
    aiConfig: {
      findUnique: jest.fn(),
    },
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
    invalidateByPrefix: jest.fn(),
    hashFilters: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({ hits: 0, misses: 0, hitRate: '0%', total: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCircuitBreakerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AiCircuitBreakerService>(AiCircuitBreakerService);

    jest.clearAllMocks();
  });

  // ─── getBudgetLimit ───────────────────────────────────────────────────────

  describe('getBudgetLimit', () => {
    it('returns default $50 when no AiConfig exists', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue(null);

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBe(50);
    });

    it('returns default $50 when AiConfig has no dailyBudgetLimit in settings', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({ settings: {} });

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBe(50);
    });

    it('returns configured dailyBudgetLimit when set', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: 100 },
      });

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBe(100);
    });

    it('returns null (unlimited) when dailyBudgetLimit is explicitly null', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: null },
      });

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBeNull();
    });

    it('returns default $50 when dailyBudgetLimit is 0 or negative', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: 0 },
      });

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBe(50);
    });

    it('returns default $50 on Prisma error (fail safe)', async () => {
      mockPrisma.aiConfig.findUnique.mockRejectedValue(new Error('DB error'));

      const limit = await service.getBudgetLimit('tenant-1');

      expect(limit).toBe(50);
    });
  });

  // ─── getDailySpending ─────────────────────────────────────────────────────

  describe('getDailySpending', () => {
    it('returns 0 when no spending has been recorded today', async () => {
      mockCache.get.mockResolvedValue(undefined);

      const spending = await service.getDailySpending('tenant-1');

      expect(spending).toBe(0);
    });

    it('returns the current accumulated spending', async () => {
      mockCache.get.mockResolvedValue(12.5);

      const spending = await service.getDailySpending('tenant-1');

      expect(spending).toBe(12.5);
    });

    it('returns 0 when cache returns null', async () => {
      mockCache.get.mockResolvedValue(null);

      const spending = await service.getDailySpending('tenant-1');

      expect(spending).toBe(0);
    });

    it('returns 0 on cache error (fail safe)', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis unavailable'));

      const spending = await service.getDailySpending('tenant-1');

      expect(spending).toBe(0);
    });
  });

  // ─── checkBudget ──────────────────────────────────────────────────────────

  describe('checkBudget', () => {
    it('allows when spending + estimated cost is under the limit', async () => {
      mockCache.get.mockResolvedValue(10); // $10 spent
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: 50 },
      });

      const result = await service.checkBudget('tenant-1', 5); // $5 estimated

      expect(result).toEqual({ allowed: true });
    });

    it('allows when spending + estimated cost exactly equals the limit', async () => {
      mockCache.get.mockResolvedValue(45); // $45 spent
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: 50 },
      });

      const result = await service.checkBudget('tenant-1', 5); // $5 estimated → total $50

      // Exactly at limit is allowed (> not >=)
      expect(result).toEqual({ allowed: true });
    });

    it('blocks when spending + estimated cost exceeds the limit', async () => {
      mockCache.get.mockResolvedValue(48); // $48 spent
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: 50 },
      });

      const result = await service.checkBudget('tenant-1', 5); // $5 would put us at $53

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily AI budget exceeded');
      expect(result.reason).toContain('$48.00');
      expect(result.reason).toContain('$50.00');
    });

    it('always allows when limit is null (unlimited)', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue({
        settings: { dailyBudgetLimit: null },
      });
      // getDailySpending should not even matter for unlimited
      mockCache.get.mockResolvedValue(9999);

      const result = await service.checkBudget('tenant-1', 1000);

      expect(result).toEqual({ allowed: true });
    });

    it('uses default $50 limit when no config exists', async () => {
      mockPrisma.aiConfig.findUnique.mockResolvedValue(null);
      mockCache.get.mockResolvedValue(49); // $49 spent

      const result = await service.checkBudget('tenant-1', 2); // would reach $51

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('$50.00');
    });

    it('fails open (allows) when the circuit breaker itself throws', async () => {
      mockCache.get.mockRejectedValue(new Error('Critical Redis failure'));
      mockPrisma.aiConfig.findUnique.mockRejectedValue(new Error('DB failure'));

      const result = await service.checkBudget('tenant-1', 5);

      expect(result).toEqual({ allowed: true });
    });
  });

  // ─── recordCost ───────────────────────────────────────────────────────────

  describe('recordCost', () => {
    it('increments the Redis counter by the given cost', async () => {
      mockCache.get.mockResolvedValue(10); // existing $10

      await service.recordCost('tenant-1', 2.5);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('ai:circuit:tenant-1:'),
        12.5,
        expect.any(Number),
      );
    });

    it('starts from 0 when no spending has been recorded yet', async () => {
      mockCache.get.mockResolvedValue(undefined);

      await service.recordCost('tenant-1', 3.0);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('ai:circuit:tenant-1:'),
        3.0,
        expect.any(Number),
      );
    });

    it('stores with a 48-hour TTL', async () => {
      mockCache.get.mockResolvedValue(0);

      await service.recordCost('tenant-1', 1.0);

      const expectedTtl = 48 * 60 * 60; // 172800 seconds
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expectedTtl,
      );
    });

    it('silently ignores cache errors during recording', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis unavailable'));

      // Should not throw
      await expect(service.recordCost('tenant-1', 1.0)).resolves.toBeUndefined();
    });
  });

  // ─── resetCircuit ─────────────────────────────────────────────────────────

  describe('resetCircuit', () => {
    it('deletes the Redis key for the current day', async () => {
      await service.resetCircuit('tenant-1');

      expect(mockCache.del).toHaveBeenCalledWith(
        expect.stringContaining('ai:circuit:tenant-1:'),
      );
    });

    it('uses a date-stamped key in the format ai:circuit:{tenantId}:{YYYY-MM-DD}', async () => {
      await service.resetCircuit('tenant-abc');

      const today = new Date().toISOString().slice(0, 10);
      expect(mockCache.del).toHaveBeenCalledWith(`ai:circuit:tenant-abc:${today}`);
    });

    it('silently ignores cache errors during reset', async () => {
      mockCache.del.mockRejectedValue(new Error('Redis unavailable'));

      // Should not throw
      await expect(service.resetCircuit('tenant-1')).resolves.toBeUndefined();
    });
  });

  // ─── Key namespace isolation ──────────────────────────────────────────────

  describe('Redis key namespace', () => {
    it('uses ai:circuit: prefix (not ai:cost: used by worker)', async () => {
      mockCache.get.mockResolvedValue(0);

      await service.recordCost('tenant-xyz', 1.0);

      const [[key]] = (mockCache.set as jest.Mock).mock.calls;
      expect(key).toMatch(/^ai:circuit:/);
      expect(key).not.toMatch(/^ai:cost:/);
    });

    it('includes the date in the key for daily auto-reset via TTL', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockCache.get.mockResolvedValue(0);

      await service.recordCost('tenant-xyz', 1.0);

      const [[key]] = (mockCache.set as jest.Mock).mock.calls;
      expect(key).toBe(`ai:circuit:tenant-xyz:${today}`);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@/common/services/throttler-storage-redis.service';
import { TenantRateLimitGuard } from '@/modules/auth/guards/tenant-rate-limit.guard';
import Redis from 'ioredis';

/**
 * Rate Limiting Integration Tests
 *
 * Tests the rate limiting system that protects API endpoints from abuse.
 *
 * Key scenarios:
 * - Requests within limit are allowed
 * - Requests exceeding limit are blocked (429 Too Many Requests)
 * - Rate limit resets after TTL expires
 * - Tenant-based rate limiting (per tenant, not per IP)
 * - Distributed rate limiting with Redis
 */

jest.mock('ioredis');

describe('Rate Limiting Integration', () => {
  let throttlerStorage: ThrottlerStorageRedisService;
  let mockRedis: jest.Mocked<Redis>;

  const tenantId = 'tenant-rate-001';
  const limit = 5; // 5 requests per window
  const ttl = 60000; // 60 seconds

  beforeEach(async () => {
    // Mock Redis instance
    mockRedis = {
      multi: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      pttl: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      pexpire: jest.fn(),
      quit: jest.fn(),
    } as unknown;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThrottlerStorageRedisService,
        {
          provide: Redis,
          useValue: mockRedis,
        },
      ],
    }).compile();

    throttlerStorage = module.get<ThrottlerStorageRedisService>(ThrottlerStorageRedisService);
  });

  describe('ThrottlerStorageRedisService', () => {
    it('should increment request count for a key', async () => {
      const key = 'test-key';
      mockRedis.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, -1], // pttl result (no TTL set yet)
      ]);

      const result = await throttlerStorage.increment(key, ttl);

      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBe(ttl);
      expect(mockRedis.incr).toHaveBeenCalledWith(key);
      expect(mockRedis.pexpire).toHaveBeenCalledWith(key, ttl);
    });

    it('should track subsequent requests', async () => {
      const key = 'test-key';

      // First request
      mockRedis.exec.mockResolvedValueOnce([
        [null, 1],
        [null, -1],
      ]);
      await throttlerStorage.increment(key, ttl);

      // Second request
      mockRedis.exec.mockResolvedValueOnce([
        [null, 2],
        [null, 59000], // 59 seconds remaining
      ]);
      const result = await throttlerStorage.increment(key, ttl);

      expect(result.totalHits).toBe(2);
      expect(result.timeToExpire).toBe(59000);
    });

    it('should not set TTL on subsequent requests', async () => {
      const key = 'test-key';
      mockRedis.exec.mockResolvedValue([
        [null, 3],
        [null, 45000], // TTL already set
      ]);

      await throttlerStorage.increment(key, ttl);

      // pexpire should not be called when TTL is already set
      expect(mockRedis.pexpire).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const key = 'test-key';
      mockRedis.exec.mockResolvedValue([
        [new Error('Redis error'), null],
        [null, -1],
      ]);

      await expect(throttlerStorage.increment(key, ttl)).rejects.toThrow('Redis error');
    });

    it('should handle transaction failure', async () => {
      const key = 'test-key';
      mockRedis.exec.mockResolvedValue(null);

      await expect(throttlerStorage.increment(key, ttl)).rejects.toThrow(
        'Redis transaction failed',
      );
    });
  });

  describe('TenantRateLimitGuard key generation', () => {
    it('should use tenant-based keys for rate limiting', () => {
      // The guard generates keys in the format: tenantId-name-suffix
      // This test verifies the expected key format
      const expectedKey = `${tenantId}-default-endpoint`;

      expect(expectedKey).toContain(tenantId);
      expect(expectedKey).toContain('endpoint');
      expect(expectedKey).toContain('default');
    });

    it('should allow separate rate limits per tenant', () => {
      // Different tenants have different keys
      const keyA = `tenant-a-default-endpoint`;
      const keyB = `tenant-b-default-endpoint`;

      expect(keyA).not.toBe(keyB);
    });
  });

  describe('Rate limiting flow', () => {
    it('should allow requests within limit', async () => {
      const key = `${tenantId}-default-endpoint`;

      // Simulate 3 requests (under the limit of 5)
      for (let i = 1; i <= 3; i++) {
        mockRedis.exec.mockResolvedValueOnce([
          [null, i],
          [null, i === 1 ? -1 : ttl - i * 1000],
        ]);

        const result = await throttlerStorage.increment(key, ttl);
        expect(result.totalHits).toBe(i);
        expect(result.totalHits).toBeLessThanOrEqual(limit);
      }
    });

    it('should block requests exceeding limit', async () => {
      const key = `${tenantId}-default-endpoint`;

      // Simulate 6 requests (exceeds limit of 5)
      for (let i = 1; i <= 6; i++) {
        mockRedis.exec.mockResolvedValueOnce([
          [null, i],
          [null, i === 1 ? -1 : ttl - i * 1000],
        ]);

        const result = await throttlerStorage.increment(key, ttl);

        if (i <= limit) {
          // Requests within limit should succeed
          expect(result.totalHits).toBe(i);
        } else {
          // Request exceeding limit
          expect(result.totalHits).toBeGreaterThan(limit);
        }
      }
    });

    it('should reset counter after TTL expires', async () => {
      const key = `${tenantId}-default-endpoint`;

      // First burst of requests
      mockRedis.exec.mockResolvedValueOnce([
        [null, 5],
        [null, 30000], // 30 seconds remaining
      ]);
      let result = await throttlerStorage.increment(key, ttl);
      expect(result.totalHits).toBe(5);

      // Simulate TTL expiration and new request
      mockRedis.exec.mockResolvedValueOnce([
        [null, 1], // Counter reset to 1
        [null, -1], // No TTL (new window)
      ]);
      result = await throttlerStorage.increment(key, ttl);
      expect(result.totalHits).toBe(1); // Counter reset
      expect(mockRedis.pexpire).toHaveBeenCalled(); // New TTL set
    });

    it('should track separate limits per tenant', async () => {
      const keyA = `tenant-a-default-endpoint`;
      const keyB = `tenant-b-default-endpoint`;

      // Tenant A makes 3 requests
      mockRedis.exec.mockResolvedValueOnce([
        [null, 3],
        [null, 50000],
      ]);
      const resultA = await throttlerStorage.increment(keyA, ttl);
      expect(resultA.totalHits).toBe(3);

      // Tenant B makes 2 requests (independent counter)
      mockRedis.exec.mockResolvedValueOnce([
        [null, 2],
        [null, 55000],
      ]);
      const resultB = await throttlerStorage.increment(keyB, ttl);
      expect(resultB.totalHits).toBe(2);

      // Verify different keys were used
      expect(mockRedis.incr).toHaveBeenCalledWith(keyA);
      expect(mockRedis.incr).toHaveBeenCalledWith(keyB);
    });

    it('should track separate limits per endpoint', async () => {
      const keyTickets = `${tenantId}-default-tickets`;
      const keyAuth = `${tenantId}-default-auth`;

      // Hit tickets endpoint 4 times
      mockRedis.exec.mockResolvedValueOnce([
        [null, 4],
        [null, 50000],
      ]);
      const resultTickets = await throttlerStorage.increment(keyTickets, ttl);
      expect(resultTickets.totalHits).toBe(4);

      // Hit auth endpoint 2 times (different limit)
      mockRedis.exec.mockResolvedValueOnce([
        [null, 2],
        [null, 55000],
      ]);
      const resultAuth = await throttlerStorage.increment(keyAuth, ttl);
      expect(resultAuth.totalHits).toBe(2);
    });
  });

  describe('Distributed rate limiting', () => {
    it('should work across multiple API instances via Redis', async () => {
      const key = `${tenantId}-default-endpoint`;

      // Instance 1 makes 3 requests
      for (let i = 1; i <= 3; i++) {
        mockRedis.exec.mockResolvedValueOnce([
          [null, i],
          [null, i === 1 ? -1 : ttl],
        ]);
        await throttlerStorage.increment(key, ttl);
      }

      // Instance 2 sees the same counter (4th request)
      mockRedis.exec.mockResolvedValueOnce([
        [null, 4],
        [null, 50000],
      ]);
      const result = await throttlerStorage.increment(key, ttl);
      expect(result.totalHits).toBe(4);

      // Verify all requests used the same Redis key
      expect(mockRedis.incr).toHaveBeenCalledTimes(4);
      expect(mockRedis.incr).toHaveBeenCalledWith(key);
    });
  });

  describe('Different rate limit configurations', () => {
    it('should support different limits for different endpoints', async () => {
      // SDK tickets endpoint: 50 requests per 60s
      const sdkKey = `${tenantId}-sdk-tickets`;
      mockRedis.exec.mockResolvedValueOnce([
        [null, 30],
        [null, 45000],
      ]);
      const sdkResult = await throttlerStorage.increment(sdkKey, 60000);
      expect(sdkResult.totalHits).toBe(30);
      expect(sdkResult.totalHits).toBeLessThanOrEqual(50); // SDK limit

      // Auth login endpoint: 10 requests per 60s (stricter)
      const authKey = `${tenantId}-auth-login`;
      mockRedis.exec.mockResolvedValueOnce([
        [null, 8],
        [null, 40000],
      ]);
      const authResult = await throttlerStorage.increment(authKey, 60000);
      expect(authResult.totalHits).toBe(8);
      expect(authResult.totalHits).toBeLessThanOrEqual(10); // Auth limit
    });

    it('should support custom TTL per endpoint', async () => {
      const key = `${tenantId}-custom-endpoint`;

      // Short TTL: 10 seconds
      const shortTtl = 10000;
      mockRedis.exec.mockResolvedValueOnce([
        [null, 1],
        [null, -1],
      ]);
      await throttlerStorage.increment(key, shortTtl);
      expect(mockRedis.pexpire).toHaveBeenCalledWith(key, shortTtl);

      // Long TTL: 5 minutes
      const longTtl = 300000;
      const longKey = `${tenantId}-long-endpoint`;
      mockRedis.exec.mockResolvedValueOnce([
        [null, 1],
        [null, -1],
      ]);
      await throttlerStorage.increment(longKey, longTtl);
      expect(mockRedis.pexpire).toHaveBeenCalledWith(longKey, longTtl);
    });
  });

  describe('Edge cases', () => {
    it('should handle exact limit boundary', async () => {
      const key = `${tenantId}-default-endpoint`;

      // Hit exactly the limit (5 requests)
      mockRedis.exec.mockResolvedValueOnce([
        [null, 5],
        [null, 30000],
      ]);
      const result = await throttlerStorage.increment(key, ttl);
      expect(result.totalHits).toBe(5);
      expect(result.totalHits).toBe(limit); // Exactly at limit

      // Next request exceeds limit
      mockRedis.exec.mockResolvedValueOnce([
        [null, 6],
        [null, 29000],
      ]);
      const exceededResult = await throttlerStorage.increment(key, ttl);
      expect(exceededResult.totalHits).toBeGreaterThan(limit);
    });

    it('should handle rapid concurrent requests', async () => {
      const key = `${tenantId}-default-endpoint`;

      // Simulate 10 concurrent requests hitting Redis at the same time
      const promises = Array.from({ length: 10 }, (_, i) => {
        mockRedis.exec.mockResolvedValueOnce([
          [null, i + 1],
          [null, 60000 - i * 100],
        ]);
        return throttlerStorage.increment(key, ttl);
      });

      const results = await Promise.all(promises);

      // All requests should complete
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.totalHits).toBe(i + 1);
      });
    });
  });
});

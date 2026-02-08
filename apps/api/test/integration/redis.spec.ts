import Redis from 'ioredis';

/**
 * Redis Integration Tests
 *
 * Tests Redis operations with a real Redis instance.
 * Requires TEST_REDIS_URL environment variable.
 */

const isIntegrationTest = !!process.env.TEST_REDIS_URL;

(isIntegrationTest ? describe : describe.skip)('Redis Integration', () => {
  let redis: Redis;
  const testPrefix = `test:${Date.now()}:`;

  beforeAll(async () => {
    redis = new Redis(process.env.TEST_REDIS_URL!);
  });

  afterAll(async () => {
    // Cleanup test keys
    const keys = await redis.keys(`${testPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      const key = `${testPrefix}simple`;
      await redis.set(key, 'test-value');

      const value = await redis.get(key);
      expect(value).toBe('test-value');
    });

    it('should set value with expiry', async () => {
      const key = `${testPrefix}expiry`;
      await redis.setex(key, 5, 'expiring-value');

      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5);
    });

    it('should increment a counter', async () => {
      const key = `${testPrefix}counter`;

      await redis.set(key, '0');
      await redis.incr(key);
      await redis.incr(key);

      const value = await redis.get(key);
      expect(value).toBe('2');
    });
  });

  describe('Hash Operations', () => {
    it('should set and get hash fields', async () => {
      const key = `${testPrefix}hash`;

      await redis.hset(key, {
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      });

      const name = await redis.hget(key, 'name');
      expect(name).toBe('Test User');

      const all = await redis.hgetall(key);
      expect(all).toEqual({
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      });
    });
  });

  describe('List Operations (Queue)', () => {
    it('should push and pop from list', async () => {
      const key = `${testPrefix}queue`;

      await redis.lpush(key, 'job-1', 'job-2', 'job-3');

      const job = await redis.rpop(key);
      expect(job).toBe('job-1');

      const length = await redis.llen(key);
      expect(length).toBe(2);
    });
  });

  describe('Set Operations', () => {
    it('should add and check set membership', async () => {
      const key = `${testPrefix}set`;

      await redis.sadd(key, 'member-1', 'member-2', 'member-3');

      const isMember = await redis.sismember(key, 'member-2');
      expect(isMember).toBe(1);

      const notMember = await redis.sismember(key, 'member-99');
      expect(notMember).toBe(0);
    });
  });

  describe('Session Storage', () => {
    it('should store and retrieve session data', async () => {
      const sessionId = `${testPrefix}session:${Date.now()}`;
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'user@example.com',
        createdAt: new Date().toISOString(),
      };

      // Store session with 1 hour expiry
      await redis.setex(sessionId, 3600, JSON.stringify(sessionData));

      // Retrieve session
      const stored = await redis.get(sessionId);
      const parsed = JSON.parse(stored!);

      expect(parsed.userId).toBe(sessionData.userId);
      expect(parsed.tenantId).toBe(sessionData.tenantId);
    });
  });

  describe('Rate Limiting', () => {
    it('should implement sliding window rate limit', async () => {
      const key = `${testPrefix}ratelimit:user-123`;
      const windowSize = 60; // 1 minute
      const maxRequests = 10;

      // Simulate requests
      for (let i = 0; i < 5; i++) {
        await redis.incr(key);
      }
      await redis.expire(key, windowSize);

      const count = await redis.get(key);
      expect(parseInt(count!)).toBe(5);

      // Check if under limit
      const underLimit = parseInt(count!) < maxRequests;
      expect(underLimit).toBe(true);
    });
  });
});

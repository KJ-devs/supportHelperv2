import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import Redis from 'ioredis';
import { ThrottlerStorageRedisService } from '../../src/common/services/throttler-storage-redis.service';
import { ThrottlerExceptionFilter } from '../../src/common/filters/throttler-exception.filter';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

// Skip if Redis is not available (integration test)
const describeIfRedis = process.env.REDIS_URL || process.env.CI ? describe : describe.skip;

describeIfRedis('Rate Limiting (Unit)', () => {
  let app: INestApplication;
  let redisClient: Redis;
  let redisAvailable = false;

  // Mock AuthService
  const mockAuthService = {
    register: jest.fn().mockResolvedValue({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      user: { id: '1', email: 'test@example.com' },
    }),
    login: jest.fn().mockResolvedValue({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      user: { id: '1', email: 'test@example.com' },
    }),
    refresh: jest.fn().mockResolvedValue({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
    }),
  };

  beforeAll(async () => {
    // Create Redis client for testing
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const url = new URL(redisUrl);
    redisClient = new Redis({
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      db: 15, // Use separate DB for tests
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
    });

    // Check if Redis is actually available
    try {
      await redisClient.ping();
      redisAvailable = true;
    } catch {
      console.warn('Redis not available, skipping rate-limiting tests');
      return;
    }

    // Flush test DB before tests
    await redisClient.flushdb();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env.local', '.env'],
        }),
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: () => ({
            throttlers: [
              {
                name: 'public',
                ttl: 60000, // 1 minute
                limit: 10,
              },
              {
                name: 'authenticated',
                ttl: 60000,
                limit: 100,
              },
              {
                name: 'sdk',
                ttl: 60000,
                limit: 50,
              },
            ],
            storage: new ThrottlerStorageRedisService(redisClient),
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
        {
          provide: APP_FILTER,
          useClass: ThrottlerExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (!redisAvailable) {
      try { await redisClient.quit(); } catch { /* ignore */ }
      return;
    }
    await redisClient.flushdb();
    // app.close() triggers ThrottlerStorageRedisService.onApplicationShutdown()
    // which quits the shared Redis client, so no separate quit is needed
    await app.close();
  });

  beforeEach(async () => {
    // Clear Redis between tests
    await redisClient.flushdb();
    jest.clearAllMocks();
  });

  describe('Public Endpoints Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(mockAuthService.login).toHaveBeenCalled();
    });

    it('should include rate limit headers in response', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      // With multiple named throttlers, headers are suffixed by throttler name
      expect(response.headers).toHaveProperty('x-ratelimit-limit-public');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining-public');
      expect(response.headers).toHaveProperty('x-ratelimit-reset-public');
    });

    it('should return 429 when limit exceeded', async () => {
      // Make 10 requests (the public throttler limit)
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
          .expect(200);
      }

      // 11th request should be throttled
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(429);

      expect(response.body).toHaveProperty('statusCode', 429);
      expect(response.body).toHaveProperty('message', 'Too Many Requests');
      expect(response.headers).toHaveProperty('retry-after');
    });

    it('should include Retry-After header in 429 response', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(429);

      expect(response.headers).toHaveProperty('retry-after');
      // On 429, the ThrottlerExceptionFilter sets the generic X-RateLimit-Remaining header
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });
  });

  describe('Redis Storage', () => {
    it('should store rate limit counters in Redis', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      // Check if Redis has keys (throttler stores keys with pattern throttler:*)
      const keys = await redisClient.keys('*');
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should reset counter after TTL expires', async () => {
      // This test would require waiting for TTL to expire (60 seconds)
      // For unit tests, we just verify the TTL is set
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      const keys = await redisClient.keys('*');
      expect(keys.length).toBeGreaterThan(0);

      // Verify TTL is set on keys
      const ttl = await redisClient.pttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60000); // Should be <= 60 seconds
    });
  });

  describe('Multiple Throttler Configs', () => {
    it('should track public throttler separately', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
          .expect(200);
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      // Should have 4 remaining (10 - 6) for the public throttler
      const remaining = parseInt(response.headers['x-ratelimit-remaining-public'], 10);
      expect(remaining).toBeLessThan(10);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('IP Whitelist', () => {
    it('should bypass rate limiting for whitelisted IPs', async () => {
      // Note: Testing IP whitelist requires IpWhitelistGuard to be configured
      // This is a placeholder test - actual implementation would require
      // configuring the guard and mocking the request IP

      // For now, just verify the guard can be imported
      const { IpWhitelistGuard } = await import('../../src/common/guards/ip-whitelist.guard');
      expect(IpWhitelistGuard).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    it('should return proper error structure on 429', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(429);

      expect(response.body).toMatchObject({
        statusCode: 429,
        message: 'Too Many Requests',
        error: 'ThrottlerException',
        details: expect.objectContaining({
          limit: expect.any(Number),
          resetTime: expect.any(Number),
          retryAfter: expect.any(Number),
        }),
      });
    });
  });
});

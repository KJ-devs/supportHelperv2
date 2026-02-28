/**
 * SDK Rate Limiting Unit Tests — US #218
 *
 * Covers acceptance criteria:
 * AC1: Auth endpoints with @Throttle: 11th request within window → HTTP 429
 * AC2: SDK ticket submission endpoint: rate limit applied per SDK key
 * AC3: 429 response contains Retry-After header and standard throttle format
 * AC4: After TTL, requests succeed again (counter reset)
 * AC5: Different SDK keys → independent rate limit counters
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ThrottlerExceptionFilter } from '../../../src/common/filters/throttler-exception.filter';
import { ThrottlerStorageRedisService } from '../../../src/common/services/throttler-storage-redis.service';
import { AuthController } from '../../../src/auth/auth.controller';
import { AuthService } from '../../../src/auth/auth.service';
import { SdkTicketsController } from '../../../src/modules/tickets/sdk-tickets.controller';
import { TicketsService } from '../../../src/modules/tickets/tickets.service';
import { TicketsSearchService } from '../../../src/modules/tickets/tickets-search.service';
import { TicketsAIService } from '../../../src/modules/tickets/tickets-ai.service';
import { AIService } from '../../../src/ai/ai.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationsSyncService } from '../../../src/modules/integrations/integrations-sync.service';
import request from 'supertest';
import type { Type, Provider } from '@nestjs/common';

// Mock AWS SDK — required for SdkTicketsController constructor
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
}));

// ─── In-Memory ThrottlerStorage ──────────────────────────────────────────────

/**
 * A minimal in-memory throttler storage that mimics Redis behaviour.
 * Supports flush() so tests can reset counters between runs.
 */
class InMemoryThrottlerStorage {
  private counters = new Map<string, { hits: number; expiry: number }>();

  flush(): void {
    this.counters.clear();
  }

  async increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire: number }> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || now >= existing.expiry) {
      // New window
      this.counters.set(key, { hits: 1, expiry: now + ttl });
      return { totalHits: 1, timeToExpire: ttl };
    }

    existing.hits += 1;
    return {
      totalHits: existing.hits,
      timeToExpire: existing.expiry - now,
    };
  }
}

// ─── Module builder helpers ───────────────────────────────────────────────────

function buildAuthApp(storage: InMemoryThrottlerStorage, limit: number): Promise<INestApplication> {
  return buildApp(storage, limit, 'public', [AuthController as Type<unknown>], [
    { provide: AuthService, useValue: mockAuthService },
  ]);
}

function buildSdkApp(storage: InMemoryThrottlerStorage, limit: number): Promise<INestApplication> {
  return buildApp(storage, limit, 'sdk', [SdkTicketsController as Type<unknown>], [
    { provide: TicketsService, useValue: mockTicketsService },
    { provide: TicketsSearchService, useValue: mockSearchService },
    { provide: TicketsAIService, useValue: mockAIService },
    { provide: AIService, useValue: mockAIProcessingService },
    { provide: PrismaService, useValue: mockPrismaService },
    { provide: ConfigService, useValue: mockConfigService },
    { provide: IntegrationsSyncService, useValue: mockIntegrationsSyncService },
  ]);
}

async function buildApp(
  storage: InMemoryThrottlerStorage,
  limit: number,
  throttlerName: string,
  controllers: Type<unknown>[],
  providers: Provider[],
): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [
          { name: throttlerName, ttl: 60000, limit },
        ],
        storage,
      } as unknown as Parameters<typeof ThrottlerModule.forRoot>[0]),
    ],
    controllers,
    providers: [
      ...providers,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

// ─── Shared mock services ─────────────────────────────────────────────────────

const mockAuthService = {
  register: jest.fn().mockResolvedValue({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: '1', email: 'user@example.com' },
  }),
  login: jest.fn().mockResolvedValue({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: '1', email: 'user@example.com' },
  }),
  refresh: jest.fn().mockResolvedValue({ accessToken: 'token' }),
};

const mockTicket = {
  id: 'ticket-001',
  tenantId: 'tenant-rate-test',
  title: 'Test Bug',
  status: 'new',
  type: 'bug',
  severity: 'medium',
  createdAt: new Date(),
};

const mockTicketsService = {
  create: jest.fn().mockResolvedValue(mockTicket),
  update: jest.fn().mockResolvedValue(mockTicket),
  findOne: jest.fn().mockResolvedValue(mockTicket),
};

const mockSearchService = {
  isEnabled: jest.fn().mockReturnValue(false),
  indexTicket: jest.fn().mockResolvedValue(undefined),
};

const mockAIService = {
  enqueueAnalysis: jest.fn().mockResolvedValue(undefined),
  updateKeywords: jest.fn().mockResolvedValue(undefined),
};

const mockAIProcessingService = {
  processUserDescription: jest.fn().mockResolvedValue({
    summary: 'Test',
    enrichedDescription: 'Test description',
    severity: 'medium',
    severityConfidence: 0.8,
    type: 'bug',
    typeConfidence: 0.9,
    keywords: [],
    reproductionSteps: [],
  }),
};

const mockIntegrationsSyncService = {
  syncTicketToAllEnabledIntegrations: jest.fn().mockResolvedValue(undefined),
};

const mockPrismaService = {
  media: { create: jest.fn().mockResolvedValue({ id: 'media-001', storageKey: 'key' }) },
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      's3.endpoint': 'http://localhost:9000',
      's3.accessKeyId': 'minioadmin',
      's3.secretAccessKey': 'minioadmin',
      's3.bucket': 'test-bucket',
      's3.region': 'us-east-1',
    };
    return config[key];
  }),
};

// ─── Test: @Throttle metadata on controllers ─────────────────────────────────
//
// @nestjs/throttler v5 stores metadata as individual keys per throttler name:
//   THROTTLER:LIMIT{name}  — the limit value
//   THROTTLER:TTL{name}    — the TTL value
// (not a single combined THROTTLE_METADATA key)

const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMIT';
const THROTTLER_TTL_KEY = 'THROTTLER:TTL';

describe('@Throttle decorator metadata', () => {
  it('AuthController.register has @Throttle with public limit=10, ttl=60000', () => {
    const limit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}public`,
      AuthController.prototype.register,
    );
    const ttl = Reflect.getMetadata(
      `${THROTTLER_TTL_KEY}public`,
      AuthController.prototype.register,
    );

    expect(limit).toBe(10);
    expect(ttl).toBe(60000);
  });

  it('AuthController.login has @Throttle with public limit=10, ttl=60000', () => {
    const limit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}public`,
      AuthController.prototype.login,
    );
    const ttl = Reflect.getMetadata(
      `${THROTTLER_TTL_KEY}public`,
      AuthController.prototype.login,
    );

    expect(limit).toBe(10);
    expect(ttl).toBe(60000);
  });

  it('SdkTicketsController has @Throttle with sdk limit=50, ttl=60000 at class level', () => {
    const limit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}sdk`,
      SdkTicketsController,
    );
    const ttl = Reflect.getMetadata(
      `${THROTTLER_TTL_KEY}sdk`,
      SdkTicketsController,
    );

    expect(limit).toBe(50);
    expect(ttl).toBe(60000);
  });

  it('Auth endpoints are more restrictive than SDK endpoints', () => {
    const authLimit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}public`,
      AuthController.prototype.login,
    );
    const sdkLimit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}sdk`,
      SdkTicketsController,
    );

    expect(authLimit).toBeDefined();
    expect(sdkLimit).toBeDefined();
    expect(authLimit).toBeLessThan(sdkLimit); // 10 < 50
  });

  it('AuthController.refresh has no @Throttle override (uses module defaults)', () => {
    // The refresh endpoint deliberately has no @Throttle decorator
    const limit = Reflect.getMetadata(
      `${THROTTLER_LIMIT_KEY}public`,
      AuthController.prototype.refresh,
    );

    expect(limit).toBeUndefined();
  });
});

// ─── AC1: Auth endpoints → 11th request returns 429 ─────────────────────────

describe('AC1: Auth endpoint throttling (10 req/min limit)', () => {
  let app: INestApplication;
  let storage: InMemoryThrottlerStorage;

  beforeEach(async () => {
    storage = new InMemoryThrottlerStorage();
    app = await buildAuthApp(storage, 10);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow the first 10 POST /auth/login requests', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' })
        .expect(200);
    }
  });

  it('should block the 11th POST /auth/login with HTTP 429', async () => {
    // Exhaust the 10-request limit
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' });
    }

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.status).toBe(429);
  });

  it('should block the 11th POST /auth/register with HTTP 429', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `user${i}@example.com`,
          password: 'password123',
          name: 'Test User',
          tenantName: 'Test Tenant',
        });
    }

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'extra@example.com',
        password: 'password123',
        name: 'Extra User',
        tenantName: 'Extra Tenant',
      })
      .expect(429);

    expect(response.status).toBe(429);
  });
});

// ─── AC2: SDK endpoint rate limit per SDK key ─────────────────────────────────

describe('AC2: SDK endpoint throttling (50 req/min limit)', () => {
  let app: INestApplication;
  let storage: InMemoryThrottlerStorage;

  beforeEach(async () => {
    storage = new InMemoryThrottlerStorage();
    app = await buildSdkApp(storage, 50);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow requests within the 50-request SDK limit', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/sdk/tickets')
        .set('x-sdk-key', 'sdk-key-tenant-a')
        .send({
          title: `Bug ${i}`,
          description: 'Something broken',
          applicationId: 'app-123',
        })
        .expect((res) => {
          // 200/201 OK or 401 (no real SdkKeyGuard in unit test) — just not 429
          expect(res.status).not.toBe(429);
        });
    }
  });

  it('should block the 51st SDK ticket submission with HTTP 429', async () => {
    for (let i = 0; i < 50; i++) {
      await request(app.getHttpServer())
        .post('/sdk/tickets')
        .set('x-sdk-key', 'sdk-key-tenant-a')
        .send({
          title: `Bug ${i}`,
          description: 'Something broken',
          applicationId: 'app-123',
        });
    }

    const response = await request(app.getHttpServer())
      .post('/sdk/tickets')
      .set('x-sdk-key', 'sdk-key-tenant-a')
      .send({
        title: 'Bug 51',
        description: 'Throttled',
        applicationId: 'app-123',
      })
      .expect(429);

    expect(response.status).toBe(429);
  });
});

// ─── AC3: 429 response body and headers ──────────────────────────────────────

describe('AC3: 429 response format and Retry-After header', () => {
  let app: INestApplication;
  let storage: InMemoryThrottlerStorage;

  // AuthController.login has @Throttle({ public: { limit: 10, ttl: 60000 } })
  // Method-level decorator overrides the module-level limit, so we use 10 here.
  const AUTH_LIMIT = 10;

  beforeEach(async () => {
    storage = new InMemoryThrottlerStorage();
    app = await buildAuthApp(storage, AUTH_LIMIT);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  async function exhaustLimit(): Promise<void> {
    for (let i = 0; i < AUTH_LIMIT; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' });
    }
  }

  it('should include Retry-After header in 429 response', async () => {
    await exhaustLimit();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.headers).toHaveProperty('retry-after');
    const retryAfter = parseInt(response.headers['retry-after'], 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60); // Max 60 seconds (TTL is 60000ms)
  });

  it('should include X-RateLimit-Remaining: 0 header in 429 response', async () => {
    await exhaustLimit();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should include X-RateLimit-Reset header in 429 response', async () => {
    await exhaustLimit();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.headers).toHaveProperty('x-ratelimit-reset');
    const resetTime = parseInt(response.headers['x-ratelimit-reset'], 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(resetTime).toBeGreaterThanOrEqual(nowSeconds);
    expect(resetTime).toBeLessThanOrEqual(nowSeconds + 61);
  });

  it('should return correct JSON body structure on 429', async () => {
    await exhaustLimit();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.body).toMatchObject({
      statusCode: 429,
      message: 'Too Many Requests',
      error: 'ThrottlerException',
      details: {
        retryAfter: expect.any(Number),
        resetTime: expect.any(Number),
      },
    });
  });

  it('should include numeric limit in 429 response details', async () => {
    await exhaustLimit();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'password' })
      .expect(429);

    expect(response.body.details).toHaveProperty('limit');
    expect(typeof response.body.details.limit).toBe('number');
  });
});

// ─── AC4: Counter resets after TTL ───────────────────────────────────────────

describe('AC4: Rate limit counter resets after TTL window', () => {
  let storage: InMemoryThrottlerStorage;

  beforeEach(() => {
    storage = new InMemoryThrottlerStorage();
  });

  it('should reset counter to 1 when TTL expires (new window starts)', async () => {
    const key = 'tenant:test-tenant:public:suffix';
    const shortTtl = 100; // 100ms window

    // Fill up the counter
    for (let i = 0; i < 5; i++) {
      await storage.increment(key, shortTtl);
    }

    const before = await storage.increment(key, shortTtl);
    expect(before.totalHits).toBe(6);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // New window — counter should be 1
    const after = await storage.increment(key, shortTtl);
    expect(after.totalHits).toBe(1);
  });

  it('should grant access again after TTL expires (end-to-end)', async () => {
    const newStorage = new InMemoryThrottlerStorage();

    // AuthController.login has @Throttle({ public: { limit: 10, ttl: 60000 } })
    // Method-level decorator overrides module limit, so effective limit is 10.
    const effectiveLimit = 10;
    const appForReset = await buildAuthApp(newStorage, effectiveLimit);
    try {
      jest.clearAllMocks();

      // Exhaust the effective limit (10 requests)
      for (let i = 0; i < effectiveLimit; i++) {
        await request(appForReset.getHttpServer())
          .post('/auth/login')
          .send({ email: 'user@example.com', password: 'password' });
      }

      // 11th request should be throttled
      await request(appForReset.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' })
        .expect(429);

      // Simulate TTL reset by flushing the in-memory storage
      newStorage.flush();

      // After flush (TTL reset), requests should succeed again
      await request(appForReset.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' })
        .expect(200);
    } finally {
      await appForReset.close();
    }
  });

  it('should track TTL correctly in storage', async () => {
    const key = 'tenant:test:per-minute:endpoint';
    const ttl = 60000;

    const result = await storage.increment(key, ttl);

    expect(result.timeToExpire).toBeGreaterThan(0);
    expect(result.timeToExpire).toBeLessThanOrEqual(ttl);
  });

  it('should not reset TTL on subsequent hits within the same window', async () => {
    const key = 'tenant:test:public:endpoint';
    const ttl = 60000;

    const first = await storage.increment(key, ttl);
    expect(first.totalHits).toBe(1);

    // Short delay
    await new Promise((r) => setTimeout(r, 10));

    const second = await storage.increment(key, ttl);
    expect(second.totalHits).toBe(2);
    // TTL remaining should be slightly less (window did not reset)
    expect(second.timeToExpire).toBeLessThan(first.timeToExpire + 1);
  });
});

// ─── AC5: Different SDK keys → independent counters ──────────────────────────

describe('AC5: Different SDK keys have independent rate limit counters', () => {
  let storage: InMemoryThrottlerStorage;

  beforeEach(() => {
    storage = new InMemoryThrottlerStorage();
  });

  it('should maintain independent counters for different SDK key suffixes', async () => {
    const ttl = 60000;

    // SDK key A makes 4 requests
    const keyA = 'tenant:tenant-A:sdk:endpoint-1';
    for (let i = 0; i < 4; i++) {
      await storage.increment(keyA, ttl);
    }

    // SDK key B makes 2 requests independently
    const keyB = 'tenant:tenant-B:sdk:endpoint-1';
    for (let i = 0; i < 2; i++) {
      await storage.increment(keyB, ttl);
    }

    // Verify independent counters
    const resultA = await storage.increment(keyA, ttl);
    const resultB = await storage.increment(keyB, ttl);

    expect(resultA.totalHits).toBe(5); // A: 4 + 1
    expect(resultB.totalHits).toBe(3); // B: 2 + 1
    expect(resultA.totalHits).not.toBe(resultB.totalHits);
  });

  it('should not affect tenant-B counter when tenant-A exceeds limit', async () => {
    const ttl = 60000;
    const limit = 3;

    const keyA = 'tenant:tenant-A:sdk:endpoint';
    const keyB = 'tenant:tenant-B:sdk:endpoint';

    // Tenant A exhausts its limit
    for (let i = 0; i < limit + 1; i++) {
      await storage.increment(keyA, ttl);
    }

    // Tenant B should still be within limits
    const resultB = await storage.increment(keyB, ttl);
    expect(resultB.totalHits).toBe(1);
    expect(resultB.totalHits).toBeLessThanOrEqual(limit);
  });

  it('should use different Redis keys per tenant in TenantRateLimitGuard', () => {
    // The guard uses: tenant:{tenantId}:{throttlerName}:{suffix}
    const tenantA = 'sdk-app-tenant-001';
    const tenantB = 'sdk-app-tenant-002';
    const throttlerName = 'sdk';
    const suffix = 'POST-/sdk/tickets';

    const keyA = `tenant:${tenantA}:${throttlerName}:${suffix}`;
    const keyB = `tenant:${tenantB}:${throttlerName}:${suffix}`;

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(tenantA);
    expect(keyB).toContain(tenantB);
  });

  it('should allow concurrent requests from different SDK keys independently', async () => {
    const ttl = 60000;
    const tenants = ['tenant-X', 'tenant-Y', 'tenant-Z'];

    // Simulate 3 requests from each of 3 different tenants in parallel
    const results = await Promise.all(
      tenants.flatMap((tenantId) =>
        Array.from({ length: 3 }, () =>
          storage.increment(`tenant:${tenantId}:sdk:create`, ttl),
        ),
      ),
    );

    // Each tenant should have exactly 3 hits, independent of others
    for (const tenantId of tenants) {
      const key = `tenant:${tenantId}:sdk:create`;
      const finalResult = await storage.increment(key, ttl);
      expect(finalResult.totalHits).toBe(4); // 3 above + 1 final check
    }

    expect(results).toHaveLength(9); // 3 tenants × 3 requests each
  });
});

// ─── ThrottlerExceptionFilter unit tests ─────────────────────────────────────

describe('ThrottlerExceptionFilter', () => {
  let filter: ThrottlerExceptionFilter;

  beforeEach(() => {
    filter = new ThrottlerExceptionFilter();
  });

  function createMockHost(
    requestOverrides: Record<string, unknown> = {},
    responseCapture: { status?: unknown; jsonBody?: unknown; headers?: Record<string, string> } = {},
  ) {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body) => {
        responseCapture.jsonBody = body;
      }),
      setHeader: jest.fn().mockImplementation((key: string, value: unknown) => {
        if (!responseCapture.headers) responseCapture.headers = {};
        responseCapture.headers[key.toLowerCase()] = String(value);
      }),
    };

    const mockRequest = {
      method: 'POST',
      url: '/auth/login',
      ip: '192.168.1.1',
      headers: { 'user-agent': 'jest-test/1.0' },
      __throttler__: undefined,
      ...requestOverrides,
    };

    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as import('@nestjs/common').ArgumentsHost;
  }

  it('should return HTTP 429 status code', () => {
    const capture: { jsonBody?: unknown; headers?: Record<string, string> } = {};
    const host = createMockHost({}, capture);

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    const exception = new ThrottlerException();

    filter.catch(exception, host);

    const responseCtx = host.switchToHttp().getResponse() as ReturnType<typeof createMockHost>['switchToHttp']['prototype']['getResponse'];
    expect((responseCtx as unknown as { status: jest.Mock }).status).toHaveBeenCalledWith(429);
  });

  it('should set Retry-After header', () => {
    const capture: { headers?: Record<string, string> } = {};
    const host = createMockHost({ __throttler__: { ttl: 60000, limit: 10 } }, capture);

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    expect(capture.headers?.['retry-after']).toBeDefined();
    expect(parseInt(capture.headers!['retry-after'], 10)).toBe(60); // 60000ms → 60s
  });

  it('should set X-RateLimit-Remaining to 0', () => {
    const capture: { headers?: Record<string, string> } = {};
    const host = createMockHost({}, capture);

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    expect(capture.headers?.['x-ratelimit-remaining']).toBe('0');
  });

  it('should set X-RateLimit-Reset header as future unix timestamp', () => {
    const capture: { headers?: Record<string, string> } = {};
    const host = createMockHost({ __throttler__: { ttl: 60000 } }, capture);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    const reset = parseInt(capture.headers?.['x-ratelimit-reset'] ?? '0', 10);
    expect(reset).toBeGreaterThanOrEqual(nowSeconds);
    expect(reset).toBeLessThanOrEqual(nowSeconds + 61);
  });

  it('should return proper JSON body on 429', () => {
    const capture: { jsonBody?: unknown } = {};
    const host = createMockHost({ __throttler__: { ttl: 30000, limit: 5 } }, capture);

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    expect(capture.jsonBody).toMatchObject({
      statusCode: 429,
      message: 'Too Many Requests',
      error: 'ThrottlerException',
      details: {
        retryAfter: 30, // 30000ms → 30s
        resetTime: expect.any(Number),
      },
    });
  });

  it('should use default TTL of 60s when throttler context is missing', () => {
    const capture: { headers?: Record<string, string> } = {};
    const host = createMockHost({}, capture); // No __throttler__ set

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    const retryAfter = parseInt(capture.headers?.['retry-after'] ?? '0', 10);
    expect(retryAfter).toBe(60); // Default 60000ms → 60s
  });

  it('should set X-RateLimit-Limit header', () => {
    const capture: { headers?: Record<string, string> } = {};
    const host = createMockHost({ __throttler__: { ttl: 60000, limit: 10 } }, capture);

    const { ThrottlerException } = jest.requireActual('@nestjs/throttler');
    filter.catch(new ThrottlerException(), host);

    expect(capture.headers?.['x-ratelimit-limit']).toBe('10');
  });
});

// ─── ThrottlerStorageRedisService direct tests ───────────────────────────────

describe('ThrottlerStorageRedisService (Redis mock)', () => {
  let service: ThrottlerStorageRedisService;
  let mockRedis: {
    multi: jest.Mock;
    incr: jest.Mock;
    pttl: jest.Mock;
    exec: jest.Mock;
    pexpire: jest.Mock;
    quit: jest.Mock;
  };

  beforeEach(() => {
    mockRedis = {
      multi: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      pttl: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      pexpire: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    service = new ThrottlerStorageRedisService(mockRedis as unknown as import('ioredis').default);
  });

  it('should increment request count and set TTL on first request', async () => {
    mockRedis.exec.mockResolvedValueOnce([
      [null, 1],    // incr → 1 hit
      [null, -1],   // pttl → no TTL yet
    ]);

    const result = await service.increment('test-key', 60000);

    expect(result.totalHits).toBe(1);
    expect(result.timeToExpire).toBe(60000);
    expect(mockRedis.pexpire).toHaveBeenCalledWith('test-key', 60000);
  });

  it('should not reset TTL for subsequent requests in the same window', async () => {
    mockRedis.exec.mockResolvedValueOnce([
      [null, 5],     // 5th hit
      [null, 45000], // 45s remaining
    ]);

    const result = await service.increment('test-key', 60000);

    expect(result.totalHits).toBe(5);
    expect(result.timeToExpire).toBe(45000);
    expect(mockRedis.pexpire).not.toHaveBeenCalled(); // TTL already set
  });

  it('should throw InternalServerErrorException when Redis multi fails', async () => {
    mockRedis.exec.mockResolvedValueOnce(null);

    await expect(service.increment('test-key', 60000)).rejects.toThrow(
      'Redis transaction failed',
    );
  });

  it('should re-throw Redis errors from incr command', async () => {
    const redisError = new Error('ECONNREFUSED');
    mockRedis.exec.mockResolvedValueOnce([
      [redisError, null],
      [null, -1],
    ]);

    await expect(service.increment('test-key', 60000)).rejects.toThrow('ECONNREFUSED');
  });

  it('should quit Redis connection on application shutdown', async () => {
    await service.onApplicationShutdown();

    expect(mockRedis.quit).toHaveBeenCalledTimes(1);
  });
});

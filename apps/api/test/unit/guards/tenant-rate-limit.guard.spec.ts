import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { TenantRateLimitGuard } from '../../../src/modules/auth/guards/tenant-rate-limit.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { RATE_LIMIT_PRESETS } from '../../../src/tenants/dto/update-rate-limits.dto';

describe('TenantRateLimitGuard', () => {
  let guard: TenantRateLimitGuard;
  let prismaService: { tenant: { findUnique: jest.Mock } };

  const mockThrottlerOptions = {
    throttlers: [
      { name: 'public', ttl: 60000, limit: 100 },
    ],
  };

  const mockThrottlerStorage: Partial<ThrottlerStorage> = {
    increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60000 }),
  };

  beforeEach(async () => {
    prismaService = {
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRateLimitGuard,
        {
          provide: 'THROTTLER_OPTIONS',
          useValue: mockThrottlerOptions,
        },
        {
          provide: ThrottlerStorage,
          useValue: mockThrottlerStorage,
        },
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    guard = module.get<TenantRateLimitGuard>(TenantRateLimitGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getThrottlerOptions', () => {
    it('should return default limits for unauthenticated requests', async () => {
      const mockContext = createMockContext({ user: undefined });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        name: 'default',
        ttl: 60000,
        limit: 10,
      });
    });

    it('should return tenant-specific custom limits', async () => {
      const tenantId = 'tenant-123';
      const customLimits = {
        requestsPerMinute: 500,
        requestsPerHour: 25000,
      };

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: { rateLimits: customLimits },
        plan: 'free',
      } as unknown as import('@prisma/client').Tenant);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({
        name: 'per-minute',
        ttl: 60000,
        limit: 500,
      });
      expect(options[1]).toEqual({
        name: 'per-hour',
        ttl: 3600000,
        limit: 25000,
      });
    });

    it('should return plan-based limits when no custom limits set', async () => {
      const tenantId = 'tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: {},
        plan: 'pro',
      } as unknown as import('@prisma/client').Tenant);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({
        name: 'per-minute',
        ttl: 60000,
        limit: RATE_LIMIT_PRESETS.pro.requestsPerMinute,
      });
      expect(options[1]).toEqual({
        name: 'per-hour',
        ttl: 3600000,
        limit: RATE_LIMIT_PRESETS.pro.requestsPerHour,
      });
    });

    it('should return enterprise plan limits', async () => {
      const tenantId = 'tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: {},
        plan: 'enterprise',
      } as unknown as import('@prisma/client').Tenant);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(2);
      expect(options[0].limit).toBe(RATE_LIMIT_PRESETS.enterprise.requestsPerMinute);
      expect(options[1].limit).toBe(RATE_LIMIT_PRESETS.enterprise.requestsPerHour);
    });

    it('should return default preset when tenant not found', async () => {
      const tenantId = 'nonexistent-tenant';

      prismaService.tenant.findUnique.mockResolvedValue(null);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(2);
      expect(options[0].limit).toBe(RATE_LIMIT_PRESETS.default.requestsPerMinute);
      expect(options[1].limit).toBe(RATE_LIMIT_PRESETS.default.requestsPerHour);
    });

    it('should use cache on subsequent requests for same tenant', async () => {
      const tenantId = 'tenant-cache-test';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: {},
        plan: 'free',
      } as unknown as import('@prisma/client').Tenant);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      // First call hits DB
      await guard['getThrottlerOptions'](mockContext);

      // Second call should use cache
      await guard['getThrottlerOptions'](mockContext);

      // Should only call DB once due to cache
      expect(prismaService.tenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return per-minute and per-hour throttlers for SDK key auth', async () => {
      const tenantId = 'sdk-tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: {},
        plan: 'pro',
      } as unknown as import('@prisma/client').Tenant);

      // SDK auth sets role: 'sdk' on the user object
      const mockContext = createMockContext({ user: { tenantId, role: 'sdk' } });

      const options = await guard['getThrottlerOptions'](mockContext);

      expect(options).toHaveLength(2);
      expect(options[0].name).toBe('per-minute');
      expect(options[1].name).toBe('per-hour');
    });
  });

  describe('generateKey', () => {
    it('should generate key with tenantId for authenticated requests', () => {
      const mockContext = createMockContext({
        user: { tenantId: 'tenant-123', role: 'member' },
      });

      const key = guard['generateKey'](mockContext, 'suffix', 'test');

      expect(key).toBe('tenant:tenant-123:test:suffix');
    });

    it('should fall back to default behavior for unauthenticated requests', () => {
      // super.generateKey requires context.getClass().name and context.getHandler().name
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
            ip: '127.0.0.1',
            path: '/api/test',
            method: 'POST',
            headers: {},
          }),
        }),
        getHandler: jest.fn().mockReturnValue({ name: 'testHandler' }),
        getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      } as unknown as ExecutionContext;

      const key = guard['generateKey'](mockContext, 'suffix', 'test');

      // Falls back to super.generateKey — result is an md5 hash (IP-based)
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key).not.toContain('tenant:');
    });

    it('should isolate rate limit keys between different tenants', () => {
      const contextA = createMockContext({ user: { tenantId: 'tenant-A', role: 'member' } });
      const contextB = createMockContext({ user: { tenantId: 'tenant-B', role: 'member' } });

      const keyA = guard['generateKey'](contextA, 'endpoint', 'per-minute');
      const keyB = guard['generateKey'](contextB, 'endpoint', 'per-minute');

      expect(keyA).toBe('tenant:tenant-A:per-minute:endpoint');
      expect(keyB).toBe('tenant:tenant-B:per-minute:endpoint');
      expect(keyA).not.toBe(keyB);
    });

    it('should include the throttler name in the key', () => {
      const mockContext = createMockContext({
        user: { tenantId: 'tenant-123', role: 'member' },
      });

      const perMinuteKey = guard['generateKey'](mockContext, 'suffix', 'per-minute');
      const perHourKey = guard['generateKey'](mockContext, 'suffix', 'per-hour');

      expect(perMinuteKey).toContain('per-minute');
      expect(perHourKey).toContain('per-hour');
      expect(perMinuteKey).not.toBe(perHourKey);
    });
  });
});

function createMockContext(requestData: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ...requestData,
        ip: '127.0.0.1',
        path: '/api/test',
        method: 'POST',
        headers: {},
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
}

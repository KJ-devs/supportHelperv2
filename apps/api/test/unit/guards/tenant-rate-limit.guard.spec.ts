import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { TenantRateLimitGuard } from '../../../src/modules/auth/guards/tenant-rate-limit.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { RATE_LIMIT_PRESETS } from '../../../src/tenants/dto/update-rate-limits.dto';

describe('TenantRateLimitGuard', () => {
  let guard: TenantRateLimitGuard;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRateLimitGuard,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<TenantRateLimitGuard>(TenantRateLimitGuard);
    prismaService = module.get(PrismaService);
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

    it('should return default limits for enterprise plan', async () => {
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

    it('should use cache on subsequent requests', async () => {
      const tenantId = 'tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        settings: {},
        plan: 'free',
      } as unknown as import('@prisma/client').Tenant);

      const mockContext = createMockContext({ user: { tenantId, role: 'member' } });

      // First call
      await guard['getThrottlerOptions'](mockContext);

      // Second call
      await guard['getThrottlerOptions'](mockContext);

      // Should only call DB once due to cache
      expect(prismaService.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateKey', () => {
    it('should generate key with tenantId', () => {
      const mockContext = createMockContext({
        user: { tenantId: 'tenant-123', role: 'member' },
      });

      const key = guard['generateKey'](mockContext, 'suffix', 'test');

      expect(key).toContain('tenant:tenant-123:test:suffix');
    });

    it('should fall back to IP-based key for unauthenticated requests', () => {
      const mockContext = createMockContext({ user: undefined });

      const key = guard['generateKey'](mockContext, 'suffix', 'test');

      // Should call super.generateKey which uses IP
      expect(key).toBeDefined();
    });
  });
});

function createMockContext(requestData: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ...requestData,
        ip: '127.0.0.1',
      }),
    }),
  } as unknown as ExecutionContext;
}

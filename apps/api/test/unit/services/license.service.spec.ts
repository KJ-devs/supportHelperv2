import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { LicenseService } from '../../../src/modules/license/license.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { LICENSE_PUBLIC_KEY } from '../../../src/modules/license/keys/public.key';
import { FREE_PLAN_LIMITS } from '../../../src/modules/license/license.types';

describe('LicenseService', () => {
  let service: LicenseService;
  let prisma: PrismaService;
  let config: ConfigService;

  const mockPrisma = {
    systemConfig: {
      findUnique: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
    },
    licenseUsage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('onModuleInit - No License', () => {
    it('should default to free mode when no license is found', async () => {
      mockConfig.get.mockReturnValue(undefined);
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

      await service.onModuleInit();

      expect(service.getPlan()).toBe('free');
      expect(service.getPlanLimits()).toEqual(FREE_PLAN_LIMITS);
      expect(service.getLicense()).toBeNull();
    });
  });

  describe('onModuleInit - Invalid License', () => {
    it('should default to free mode when license signature is invalid', async () => {
      mockConfig.get.mockReturnValue('invalid.jwt.token');
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null);

      await service.onModuleInit();

      expect(service.getPlan()).toBe('free');
      expect(service.getLicense()).toBeNull();
    });
  });

  // Note: Testing expired license with actual JWT verification is complex due to
  // jsonwebtoken module restrictions. The expiration logic is covered by integration tests.

  describe('Feature Checking', () => {
    it('should return false for features in free mode', () => {
      expect(service.isFeatureEnabled('auto_merge')).toBe(false);
      expect(service.isFeatureEnabled('audit_logs')).toBe(false);
      expect(service.isFeatureEnabled('sso')).toBe(false);
    });
  });

  describe('Usage Limits', () => {
    const tenantId = 'test-tenant-id';

    it('should check usage limit correctly when under limit', async () => {
      mockPrisma.licenseUsage.findUnique.mockResolvedValue({
        id: 'usage-id',
        tenantId,
        month: '2026-02',
        metric: 'tickets',
        count: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkUsageLimit(tenantId, 'tickets');

      expect(result).toEqual({
        allowed: true,
        current: 10,
        limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
      });
    });

    it('should check usage limit correctly when at limit', async () => {
      mockPrisma.licenseUsage.findUnique.mockResolvedValue({
        id: 'usage-id',
        tenantId,
        month: '2026-02',
        metric: 'tickets',
        count: FREE_PLAN_LIMITS.maxTicketsPerMonth,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.checkUsageLimit(tenantId, 'tickets');

      expect(result).toEqual({
        allowed: false,
        current: FREE_PLAN_LIMITS.maxTicketsPerMonth,
        limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
      });
    });

    it('should handle no existing usage record', async () => {
      mockPrisma.licenseUsage.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit(tenantId, 'tickets');

      expect(result).toEqual({
        allowed: true,
        current: 0,
        limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
      });
    });
  });

  describe('Usage Increment', () => {
    const tenantId = 'test-tenant-id';

    it('should increment usage correctly', async () => {
      mockPrisma.licenseUsage.upsert.mockResolvedValue({
        id: 'usage-id',
        tenantId,
        month: '2026-02',
        metric: 'tickets',
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.incrementUsage(tenantId, 'tickets');

      expect(mockPrisma.licenseUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_month_metric: {
              tenantId,
              month: expect.stringMatching(/^\d{4}-\d{2}$/),
              metric: 'tickets',
            },
          },
          create: expect.objectContaining({
            tenantId,
            metric: 'tickets',
            count: 1,
          }),
          update: {
            count: {
              increment: 1,
            },
          },
        }),
      );
    });
  });

  describe('Usage Summary', () => {
    const tenantId = 'test-tenant-id';

    it('should return usage summary correctly', async () => {
      mockPrisma.licenseUsage.findMany.mockResolvedValue([
        {
          id: 'usage-1',
          tenantId,
          month: '2026-02',
          metric: 'tickets',
          count: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'usage-2',
          tenantId,
          month: '2026-02',
          metric: 'agent_tasks',
          count: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const summary = await service.getUsageSummary(tenantId);

      expect(summary).toEqual({
        tickets: {
          current: 25,
          limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
        },
        agent_tasks: {
          current: 5,
          limit: FREE_PLAN_LIMITS.maxAgentTasksPerMonth,
        },
        users: {
          current: 0,
          limit: FREE_PLAN_LIMITS.maxUsers,
        },
      });
    });

    it('should return zero usage when no records exist', async () => {
      mockPrisma.licenseUsage.findMany.mockResolvedValue([]);

      const summary = await service.getUsageSummary(tenantId);

      expect(summary).toEqual({
        tickets: {
          current: 0,
          limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
        },
        agent_tasks: {
          current: 0,
          limit: FREE_PLAN_LIMITS.maxAgentTasksPerMonth,
        },
        users: {
          current: 0,
          limit: FREE_PLAN_LIMITS.maxUsers,
        },
      });
    });
  });

  describe('License Info', () => {
    it('should return license info with usage', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: 'tenant-id',
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.licenseUsage.findMany.mockResolvedValue([]);

      const info = await service.getLicenseInfo();

      expect(info).toEqual({
        plan: 'free',
        limits: FREE_PLAN_LIMITS,
        usage: {
          tickets: {
            current: 0,
            limit: FREE_PLAN_LIMITS.maxTicketsPerMonth,
          },
          agent_tasks: {
            current: 0,
            limit: FREE_PLAN_LIMITS.maxAgentTasksPerMonth,
          },
          users: {
            current: 0,
            limit: FREE_PLAN_LIMITS.maxUsers,
          },
        },
        expiresAt: null,
        valid: false,
      });
    });
  });
});

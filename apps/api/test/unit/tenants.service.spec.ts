import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantsService } from '../../src/tenants/tenants.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RATE_LIMIT_PRESETS } from '../../src/tenants/dto/update-rate-limits.dto';

describe('TenantsService', () => {
  let service: TenantsService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
            application: {
              count: jest.fn(),
            },
            ticket: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRateLimits', () => {
    it('should return custom rate limits if set', async () => {
      const tenantId = 'tenant-123';
      const customLimits = {
        requestsPerMinute: 500,
        requestsPerHour: 25000,
      };

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
        settings: { rateLimits: customLimits },
      } as any);

      const result = await service.getRateLimits(tenantId);

      expect(result).toEqual(customLimits);
    });

    it('should return plan-based limits if no custom limits', async () => {
      const tenantId = 'tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'pro',
        settings: {},
      } as any);

      const result = await service.getRateLimits(tenantId);

      expect(result).toEqual(RATE_LIMIT_PRESETS.pro);
    });

    it('should return default limits for unknown plan', async () => {
      const tenantId = 'tenant-123';

      prismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'unknown-plan',
        settings: {},
      } as any);

      const result = await service.getRateLimits(tenantId);

      expect(result).toEqual(RATE_LIMIT_PRESETS.default);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getRateLimits('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRateLimits', () => {
    it('should update rate limits', async () => {
      const tenantId = 'tenant-123';
      const existingTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
        settings: {
          rateLimits: {
            requestsPerMinute: 30,
            requestsPerHour: 1000,
          },
        },
      };

      prismaService.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaService.tenant.update.mockResolvedValue(existingTenant as any);

      const newLimits = {
        requestsPerMinute: 100,
      };

      const result = await service.updateRateLimits(tenantId, newLimits);

      expect(result).toEqual({
        requestsPerMinute: 100,
        requestsPerHour: 1000, // Should keep existing hour limit
      });

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            rateLimits: {
              requestsPerMinute: 100,
              requestsPerHour: 1000,
            },
          }),
        }),
      });
    });

    it('should update both minute and hour limits', async () => {
      const tenantId = 'tenant-123';
      const existingTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
        settings: {
          rateLimits: RATE_LIMIT_PRESETS.free,
        },
      };

      prismaService.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaService.tenant.update.mockResolvedValue(existingTenant as any);

      const newLimits = {
        requestsPerMinute: 500,
        requestsPerHour: 25000,
      };

      const result = await service.updateRateLimits(tenantId, newLimits);

      expect(result).toEqual(newLimits);
    });
  });

  describe('resetRateLimits', () => {
    it('should reset to plan-based limits', async () => {
      const tenantId = 'tenant-123';
      const existingTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'pro',
        settings: {
          rateLimits: {
            requestsPerMinute: 999,
            requestsPerHour: 99999,
          },
        },
      };

      prismaService.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaService.tenant.update.mockResolvedValue(existingTenant as any);

      const result = await service.resetRateLimits(tenantId);

      expect(result).toEqual(RATE_LIMIT_PRESETS.pro);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            rateLimits: RATE_LIMIT_PRESETS.pro,
          }),
        }),
      });
    });

    it('should use default limits for unknown plan', async () => {
      const tenantId = 'tenant-123';
      const existingTenant = {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'custom-plan',
        settings: {},
      };

      prismaService.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaService.tenant.update.mockResolvedValue(existingTenant as any);

      const result = await service.resetRateLimits(tenantId);

      expect(result).toEqual(RATE_LIMIT_PRESETS.default);
    });
  });
});

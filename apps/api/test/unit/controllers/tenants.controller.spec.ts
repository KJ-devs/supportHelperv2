import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantsController } from '../../../src/tenants/tenants.controller';
import { TenantsService } from '../../../src/tenants/tenants.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Mock @support-helper/shared
jest.mock('@support-helper/shared', () => ({
  generateSlug: jest.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
}));

describe('TenantsController', () => {
  let controller: TenantsController;
  let tenantsService: TenantsService;

  const mockTenantId = 'tenant-123';

  const mockTenant = {
    id: mockTenantId,
    name: 'Test Company',
    slug: 'test-company',
    plan: 'free',
    settings: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockStats = {
    tenant: mockTenant,
    stats: {
      users: 5,
      applications: 2,
      tickets: 42,
      openTickets: 12,
    },
  };

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    tenantsService = module.get<TenantsService>(TenantsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrent', () => {
    it('should return the current tenant info', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.getCurrent(req);

      expect(result).toEqual(mockTenant);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenantId },
      });
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const req = { user: { tenantId: 'nonexistent' } };

      await expect(controller.getCurrent(req)).rejects.toThrow(NotFoundException);
    });

    it('should use tenantId from authenticated user JWT', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const req = { user: { tenantId: 'specific-tenant-id' } };
      await controller.getCurrent(req);

      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'specific-tenant-id' },
      });
    });
  });

  describe('getStats', () => {
    it('should return tenant stats', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.count.mockResolvedValue(5);
      mockPrismaService.application.count.mockResolvedValue(2);
      mockPrismaService.ticket.count
        .mockResolvedValueOnce(42) // total tickets
        .mockResolvedValueOnce(12); // open tickets

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.getStats(req);

      expect(result).toEqual(mockStats);
    });

    it('should scope all stat queries to the tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.application.count.mockResolvedValue(0);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      const req = { user: { tenantId: mockTenantId } };
      await controller.getStats(req);

      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
      });
      expect(mockPrismaService.application.count).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
      });
      expect(mockPrismaService.ticket.count).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
      });
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const req = { user: { tenantId: 'nonexistent' } };

      await expect(controller.getStats(req)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant name', async () => {
      const updatedTenant = { ...mockTenant, name: 'New Company Name', updatedAt: new Date() };
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue(updatedTenant);

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.update({ name: 'New Company Name' }, req);

      expect(result.name).toBe('New Company Name');
    });

    it('should update tenant settings', async () => {
      const newSettings = { theme: 'dark', notifications: true };
      const updatedTenant = { ...mockTenant, settings: newSettings, updatedAt: new Date() };
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue(updatedTenant);

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.update({ settings: newSettings }, req);

      expect(result.settings).toEqual(newSettings);
    });

    it('should throw NotFoundException when updating non-existent tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const req = { user: { tenantId: 'nonexistent' } };

      await expect(
        controller.update({ name: 'Updated' }, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use tenantId from JWT not from body', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue(mockTenant);

      const req = { user: { tenantId: mockTenantId } };
      await controller.update({ name: 'Updated' }, req);

      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenantId },
      });
    });
  });
});

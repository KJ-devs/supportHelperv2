import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantsService } from '../../../src/tenants/tenants.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

jest.mock('@support-helper/shared', () => ({
  generateSlug: jest.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
}));

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'free',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
            },
            user: { count: jest.fn() },
            application: { count: jest.fn() },
            ticket: { count: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create tenant with generated slug', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.create as jest.Mock).mockResolvedValue(mockTenant);

      const result = await service.create({ name: 'Test Tenant' });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Tenant',
          slug: 'test-tenant',
          plan: 'free',
        }),
      });
      expect(result).toEqual(mockTenant);
    });

    it('should append suffix when slug exists', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
      (prisma.tenant.create as jest.Mock).mockResolvedValue({ ...mockTenant, slug: 'test-tenant-abc123' });

      await service.create({ name: 'Test Tenant' });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: expect.stringContaining('test-tenant-'),
        }),
      });
    });

    it('should use custom slug when provided', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.create as jest.Mock).mockResolvedValue({ ...mockTenant, slug: 'custom-slug' });

      await service.create({ name: 'Test', slug: 'custom-slug' });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'custom-slug' }),
      });
    });
  });

  describe('findOne', () => {
    it('should return tenant by id', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);

      const result = await service.findOne('tenant-123');

      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
      (prisma.tenant.update as jest.Mock).mockResolvedValue({ ...mockTenant, name: 'Updated' });

      const result = await service.update('tenant-123', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when tenant not found', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    it('should update tenant plan', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
      (prisma.tenant.update as jest.Mock).mockResolvedValue({ ...mockTenant, plan: 'pro' });

      const result = await service.updatePlan('tenant-123', 'pro');

      expect(result.plan).toBe('pro');
    });
  });

  describe('getStats', () => {
    it('should return tenant with statistics', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
      (prisma.user.count as jest.Mock).mockResolvedValue(5);
      (prisma.application.count as jest.Mock).mockResolvedValue(2);
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(25);

      const result = await service.getStats('tenant-123');

      expect(result.tenant).toEqual(mockTenant);
      expect(result.stats).toEqual({
        users: 5,
        applications: 2,
        tickets: 100,
        openTickets: 25,
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from '../../../src/applications/applications.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

// Mock the shared package
jest.mock('@support-helper/shared', () => ({
  generateSDKKey: jest.fn(() => 'sk_test_mock_key_123'),
}));

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockApplication = {
    id: 'app-123',
    tenantId: 'tenant-123',
    name: 'Test App',
    platform: 'web',
    sdkKey: 'sk_test_123',
    settings: {},
    githubRepo: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: {
            application: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            ticket: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an application with SDK key', async () => {
      const createData = {
        name: 'New App',
        platform: 'web',
      };

      (prismaService.application.create as jest.Mock).mockResolvedValue({
        ...mockApplication,
        ...createData,
        sdkKey: 'sk_test_mock_key_123',
      });

      const result = await service.create('tenant-123', createData);

      expect(result.name).toBe('New App');
      expect(result.sdkKey).toBe('sk_test_mock_key_123');
      expect(prismaService.application.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          name: 'New App',
          platform: 'web',
          githubRepo: undefined,
          sdkKey: 'sk_test_mock_key_123',
          settings: {},
        },
      });
    });
  });

  describe('findByTenant', () => {
    it('should return all applications for a tenant', async () => {
      (prismaService.application.findMany as jest.Mock).mockResolvedValue([mockApplication]);

      const result = await service.findByTenant('tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockApplication);
      expect(prismaService.application.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if no applications exist', async () => {
      (prismaService.application.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByTenant('tenant-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return an application by id and tenant', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);

      const result = await service.findOne('app-123', 'tenant-123');

      expect(result).toEqual(mockApplication);
    });

    it('should throw NotFoundException if application not found', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('app-999', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an application', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prismaService.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        name: 'Updated App',
      });

      const result = await service.update('app-123', 'tenant-123', {
        name: 'Updated App',
      });

      expect(result.name).toBe('Updated App');
    });

    it('should throw NotFoundException if application does not exist', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('app-999', 'tenant-123', { name: 'Updated' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('delete', () => {
    it('should delete an application', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prismaService.application.delete as jest.Mock).mockResolvedValue(mockApplication);

      const result = await service.delete('app-123', 'tenant-123');

      expect(result).toEqual({ success: true });
    });
  });

  describe('regenerateSdkKey', () => {
    it('should regenerate the SDK key', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prismaService.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        sdkKey: 'sk_test_mock_key_123',
      });

      const result = await service.regenerateSdkKey('app-123', 'tenant-123');

      expect(result.sdkKey).toBe('sk_test_mock_key_123');
    });
  });

  describe('getStats', () => {
    it('should return application statistics', async () => {
      (prismaService.application.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prismaService.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalTickets
        .mockResolvedValueOnce(25) // openTickets
        .mockResolvedValueOnce(75); // resolvedTickets

      const result = await service.getStats('app-123', 'tenant-123');

      expect(prismaService.ticket.count).toHaveBeenCalledTimes(3);
    });
  });
});

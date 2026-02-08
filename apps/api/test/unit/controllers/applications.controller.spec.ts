import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from '../../../src/applications/applications.controller';
import { ApplicationsService } from '../../../src/applications/applications.service';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let applicationsService: jest.Mocked<ApplicationsService>;

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

  const mockUser = {
    userId: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@example.com',
    role: 'member',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        {
          provide: ApplicationsService,
          useValue: {
            create: jest.fn(),
            findByTenant: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            regenerateSdkKey: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    applicationsService = module.get(ApplicationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an application', async () => {
      const createDto = {
        name: 'New App',
        platform: 'web',
      };

      (applicationsService.create as jest.Mock).mockResolvedValue(mockApplication);

      const result = await controller.create(createDto as any, { user: mockUser } as any);

      expect(applicationsService.create).toHaveBeenCalledWith(mockUser.tenantId, createDto);
      expect(result).toEqual(mockApplication);
    });
  });

  describe('findAll', () => {
    it('should return all applications for tenant', async () => {
      (applicationsService.findByTenant as jest.Mock).mockResolvedValue([mockApplication]);

      const result = await controller.findAll({ user: mockUser } as any);

      expect(applicationsService.findByTenant).toHaveBeenCalledWith(mockUser.tenantId);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a specific application', async () => {
      (applicationsService.findOne as jest.Mock).mockResolvedValue(mockApplication);

      const result = await controller.findOne('app-123', { user: mockUser } as any);

      expect(applicationsService.findOne).toHaveBeenCalledWith('app-123', mockUser.tenantId);
      expect(result).toEqual(mockApplication);
    });
  });

  describe('update', () => {
    it('should update an application', async () => {
      const updateDto = { name: 'Updated App' };

      (applicationsService.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        name: 'Updated App',
      });

      const result = await controller.update('app-123', updateDto as any, { user: mockUser } as any);

      expect(applicationsService.update).toHaveBeenCalledWith(
        'app-123',
        mockUser.tenantId,
        updateDto
      );
      expect(result.name).toBe('Updated App');
    });
  });

  describe('delete', () => {
    it('should delete an application', async () => {
      (applicationsService.delete as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.delete('app-123', { user: mockUser } as any);

      expect(applicationsService.delete).toHaveBeenCalledWith('app-123', mockUser.tenantId);
      expect(result).toEqual({ success: true });
    });
  });
});

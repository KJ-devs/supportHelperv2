import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from '../../../src/modules/setup/setup.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuthService } from '../../../src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, BadRequestException } from '@nestjs/common';

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      },
    })),
  };
});

describe('SetupService', () => {
  let service: SetupService;
  let prismaService: jest.Mocked<PrismaService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupService,
        {
          provide: PrismaService,
          useValue: {
            systemConfig: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SetupService>(SetupService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isSetupCompleted', () => {
    it('should return false when setup_completed config does not exist', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.isSetupCompleted();

      expect(result).toBe(false);
      expect(prismaService.systemConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'setup_completed' },
      });
    });

    it('should return true when setup is completed', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_completed',
        value: { completed: true },
      });

      const result = await service.isSetupCompleted();

      expect(result).toBe(true);
    });

    it('should return false when setup is not completed', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_completed',
        value: { completed: false },
      });

      const result = await service.isSetupCompleted();

      expect(result).toBe(false);
    });
  });

  describe('getSetupProgress', () => {
    it('should return default progress when no config exists', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getSetupProgress();

      expect(result).toEqual({
        currentStep: 1,
        completedSteps: [],
      });
    });

    it('should return saved progress', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_progress',
        value: {
          currentStep: 3,
          completedSteps: ['admin', 'ai-key', 'smtp'],
        },
      });

      const result = await service.getSetupProgress();

      expect(result).toEqual({
        currentStep: 3,
        completedSteps: ['admin', 'ai-key', 'smtp'],
      });
    });
  });

  describe('createAdmin', () => {
    it('should throw ConflictException if users already exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.createAdmin({
          email: 'admin@example.com',
          password: 'password123',
          name: 'Admin User',
          organizationName: 'Test Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create admin user when no users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);
      (authService.register as jest.Mock).mockResolvedValue({
        user: {
          id: 'user-123',
          tenantId: 'tenant-123',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'owner',
          createdAt: new Date(),
        },
        accessToken: 'token',
        refreshToken: 'refresh-token',
      });

      const result = await service.createAdmin({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        organizationName: 'Test Org',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('admin@example.com');
      expect(authService.register).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        tenantName: 'Test Org',
      });
    });
  });

  describe('saveSetupProgress', () => {
    it('should save progress to system config', async () => {
      (prismaService.systemConfig.upsert as jest.Mock).mockResolvedValue({});

      await service.saveSetupProgress({
        currentStep: 2,
        completedSteps: ['admin'],
      });

      expect(prismaService.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_progress' },
        create: {
          key: 'setup_progress',
          value: {
            currentStep: 2,
            completedSteps: ['admin'],
          },
        },
        update: {
          value: {
            currentStep: 2,
            completedSteps: ['admin'],
          },
        },
      });
    });
  });

  describe('completeSetup', () => {
    it('should throw BadRequestException if no users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await expect(service.completeSetup()).rejects.toThrow(BadRequestException);
    });

    it('should mark setup as completed when users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);
      (prismaService.systemConfig.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.completeSetup();

      expect(result).toEqual({ success: true });
      expect(prismaService.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_completed' },
        create: {
          key: 'setup_completed',
          value: { completed: true },
        },
        update: {
          value: { completed: true },
        },
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { TenantContextMiddleware } from '../../../src/modules/auth/middleware/tenant-context.middleware';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UserEntity, ApplicationEntity } from '../../../src/modules/auth/dto/auth.dto';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantContextMiddleware,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    middleware = module.get<TenantContextMiddleware>(TenantContextMiddleware);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    // Spy on console.error to suppress error output in tests
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should set tenant context when user is authenticated', async () => {
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: 'tenant-123',
        email: 'user@example.com',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      prisma.$executeRaw.mockResolvedValue(1);

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      const call = prisma.$executeRaw.mock.calls[0];
      // Template literal is passed as array + values
      expect(call[0]).toEqual(expect.arrayContaining(['SET LOCAL app.current_tenant_id = ']));
      expect(call[1]).toBe('tenant-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set tenant context for application entity', async () => {
      const mockApplication: Partial<ApplicationEntity> = {
        id: 'app-123',
        tenantId: 'tenant-456',
        name: 'Test App',
      };

      const mockRequest = {
        user: mockApplication,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      prisma.$executeRaw.mockResolvedValue(1);

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      const call = prisma.$executeRaw.mock.calls[0];
      expect(call[1]).toBe('tenant-456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip setting tenant context when user is not present', async () => {
      const mockRequest = {} as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip setting tenant context when user has no tenantId', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip setting tenant context when tenantId is null', async () => {
      const mockUser = {
        id: 'user-123',
        tenantId: null,
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip setting tenant context when tenantId is undefined', async () => {
      const mockUser = {
        id: 'user-123',
        tenantId: undefined,
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue execution even if setting tenant context fails', async () => {
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: 'tenant-123',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      const error = new Error('Database connection failed');
      prisma.$executeRaw.mockRejectedValue(error);

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log error when setting tenant context fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: 'tenant-123',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      const error = new Error('Database error');
      prisma.$executeRaw.mockRejectedValue(error);

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to set tenant context:',
        error
      );
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: "tenant-123'; DROP TABLE users; --",
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      prisma.$executeRaw.mockResolvedValue(1);

      await middleware.use(mockRequest, mockResponse, mockNext);

      // Verify that the tenantId is passed as a parameterized value
      expect(prisma.$executeRaw).toHaveBeenCalled();
      const call = prisma.$executeRaw.mock.calls[0];
      expect(call[1]).toBe("tenant-123'; DROP TABLE users; --");
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle different tenant IDs', async () => {
      const tenantIds = ['tenant-1', 'tenant-2', 'tenant-3'];

      for (const tenantId of tenantIds) {
        const mockUser: Partial<UserEntity> = {
          id: 'user-123',
          tenantId,
        };

        const mockRequest = {
          user: mockUser,
        } as unknown as Request;
        const mockResponse = {} as Response;
        const mockNext = jest.fn() as NextFunction;

        prisma.$executeRaw.mockResolvedValue(1);

        await middleware.use(mockRequest, mockResponse, mockNext);

        const call = prisma.$executeRaw.mock.calls[prisma.$executeRaw.mock.calls.length - 1];
        expect(call[1]).toBe(tenantId);
      }
    });

    it('should call next after setting tenant context', async () => {
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: 'tenant-123',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      prisma.$executeRaw.mockResolvedValue(1);

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next synchronously when no user is present', async () => {
      const mockRequest = {} as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      await middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should handle UUID tenant IDs', async () => {
      const mockUser: Partial<UserEntity> = {
        id: 'user-123',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const mockRequest = {
        user: mockUser,
      } as unknown as Request;
      const mockResponse = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      prisma.$executeRaw.mockResolvedValue(1);

      await middleware.use(mockRequest, mockResponse, mockNext);

      const call = prisma.$executeRaw.mock.calls[0];
      expect(call[1]).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

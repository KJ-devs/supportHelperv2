import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from '../../../src/modules/auth/guards/tenant.guard';
import { UserEntity, ApplicationEntity } from '../../../src/modules/auth/dto/auth.dto';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (request: any): ExecutionContext => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: () => request,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    })),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  describe('canActivate', () => {
    it('should return true and set tenantId for authenticated user', () => {
      const mockUser: UserEntity = {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'admin',
      };

      const request: any = { user: mockUser };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantId).toBe('tenant-1');
    });

    it('should return true and set tenantId for authenticated application', () => {
      const mockApp: ApplicationEntity = {
        id: 'app-1',
        tenantId: 'tenant-2',
        name: 'Test App',
        platform: 'web',
        sdkKey: 'test-key',
      };

      const request: any = { user: mockApp };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantId).toBe('tenant-2');
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const request = {};
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('User not authenticated')
      );
    });

    it('should throw ForbiddenException when user is null', () => {
      const request = { user: null };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('User not authenticated')
      );
    });

    it('should throw ForbiddenException when tenantId is missing', () => {
      const request = {
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Tenant not found')
      );
    });

    it('should throw ForbiddenException when tenantId is null', () => {
      const request = {
        user: {
          id: 'user-1',
          tenantId: null,
          email: 'user@example.com',
        },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Tenant not found')
      );
    });

    it('should throw ForbiddenException when tenantId is empty string', () => {
      const request = {
        user: {
          id: 'user-1',
          tenantId: '',
          email: 'user@example.com',
        },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Tenant not found')
      );
    });

    it('should handle user with full tenant object', () => {
      const mockUser: UserEntity = {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'owner',
        tenant: {
          id: 'tenant-1',
          name: 'Test Tenant',
          slug: 'test-tenant',
          plan: 'pro',
        },
      };

      const request: any = { user: mockUser };
      const context = createMockExecutionContext(request);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.tenantId).toBe('tenant-1');
    });

    it('should handle different user roles', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'];

      roles.forEach((role) => {
        const mockUser: UserEntity = {
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          name: 'Test User',
          role,
        };

        const request: any = { user: mockUser };
        const context = createMockExecutionContext(request);

        const result = guard.canActivate(context);

        expect(result).toBe(true);
        expect(request.tenantId).toBe('tenant-1');
      });
    });

    it('should store tenantId in request for use in services', () => {
      const mockUser: UserEntity = {
        id: 'user-1',
        tenantId: 'tenant-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'admin',
      };

      const request: any = { user: mockUser };
      const context = createMockExecutionContext(request);

      guard.canActivate(context);

      // Verify tenantId is accessible in request
      expect(request.tenantId).toBeDefined();
      expect(request.tenantId).toBe('tenant-123');
    });
  });
});

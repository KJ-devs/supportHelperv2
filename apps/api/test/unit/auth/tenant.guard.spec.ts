import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../../../src/common/guards/tenant.guard';
import { UserEntity, ApplicationEntity } from '../../../src/modules/auth/dto/auth.dto';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantGuard],
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
    it('should return true for authenticated user with tenantId', () => {
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
    });

    it('should return true for authenticated application with tenantId', () => {
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
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const request = {};
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant information not found');
    });

    it('should throw ForbiddenException when user is null', () => {
      const request = { user: null };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when tenantId is missing', () => {
      const request = {
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
      };
      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant information not found');
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

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle user with tenant object', () => {
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
    });

    it('should handle different user roles', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'];

      for (const role of roles) {
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
      }
    });
  });
});

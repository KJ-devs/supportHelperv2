import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../../../src/common/guards/tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  function createMockContext(user?: any): ExecutionContext {
    const request: any = { user };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when user has tenantId', () => {
      const user = { tenantId: 'tenant-123', id: 'user-1', role: 'admin' };
      const context = createMockContext(user);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true with UUID tenantId', () => {
      const user = { tenantId: '550e8400-e29b-41d4-a716-446655440000', id: 'user-1' };
      const context = createMockContext(user);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not set', () => {
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant information not found');
    });

    it('should throw ForbiddenException when user is null', () => {
      const context = createMockContext(null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant information not found');
    });

    it('should throw ForbiddenException when tenantId is missing', () => {
      const user = { id: 'user-1', role: 'admin' }; // no tenantId
      const context = createMockContext(user);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant information not found');
    });

    it('should throw ForbiddenException when tenantId is empty string', () => {
      const user = { id: 'user-1', tenantId: '' };
      const context = createMockContext(user);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should return true for different user roles', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'];

      for (const role of roles) {
        const user = { tenantId: 'tenant-1', id: 'user-1', role };
        const context = createMockContext(user);

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      }
    });
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { ROLES_KEY } from '../../../src/auth/decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
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
    it('should return true when no roles are required', () => {
      const context = createMockContext({ role: 'member' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when required roles is empty array', () => {
      const context = createMockContext({ role: 'member' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
      const context = createMockContext({ role: 'admin' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'owner']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should return true when user has one of multiple required roles', () => {
      const context = createMockContext({ role: 'owner' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'owner']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required role', () => {
      const context = createMockContext({ role: 'member' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'owner']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Required role: admin or owner');
    });

    it('should throw ForbiddenException when user role is viewer but admin required', () => {
      const context = createMockContext({ role: 'viewer' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Required role: admin');
    });

    it('should throw ForbiddenException when user is not on request', () => {
      const context = createMockContext(undefined);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should throw ForbiddenException when user is null', () => {
      const context = createMockContext(null);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});

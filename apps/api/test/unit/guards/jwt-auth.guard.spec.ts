import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../src/common/decorators/public.decorator';
import { IS_SDK_ROUTE_KEY } from '../../../src/common/decorators/sdk-auth.decorator';
import { IS_INTERNAL_ROUTE_KEY } from '../../../src/common/decorators/internal-route.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn(),
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
    it('should return true for routes marked as @Public()', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should return true for routes marked as @SdkAuth()', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === IS_SDK_ROUTE_KEY) return true;
        return false;
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_SDK_ROUTE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should not call passport super.canActivate() for @SdkAuth() routes', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_SDK_ROUTE_KEY) return true;
        return false;
      });

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(context);

      expect(superCanActivate).not.toHaveBeenCalled();
      superCanActivate.mockRestore();
    });

    it('should delegate to passport AuthGuard for non-public routes', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(superCanActivate).toHaveBeenCalledWith(context);
      superCanActivate.mockRestore();
    });

    it('should delegate to passport when isPublic is undefined (no decorator)', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalledWith(context);
      superCanActivate.mockRestore();
    });

    it('should delegate to passport when isPublic is explicitly false', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalledWith(context);
      superCanActivate.mockRestore();
    });

    it('should return true for routes marked as @InternalRoute()', () => {
      const context = createMockContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === IS_INTERNAL_ROUTE_KEY) return true;
        return false;
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should return user when passport validation succeeds', () => {
      const mockUser = { id: 'user-1', email: 'user@example.com', tenantId: 'tenant-1' };

      const result = guard.handleRequest(null, mockUser, null);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException with "Invalid or expired token" when token is expired', () => {
      // Passport-jwt sets err=null, user=false, info={name:'TokenExpiredError'} for expired tokens
      const tokenExpiredInfo = { name: 'TokenExpiredError', message: 'jwt expired' };

      expect(() => guard.handleRequest(null, false, tokenExpiredInfo)).toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw UnauthorizedException with "Invalid or expired token" when signature is invalid', () => {
      // Passport-jwt sets err=null, user=false, info={name:'JsonWebTokenError'} for bad signatures
      const invalidSignatureInfo = {
        name: 'JsonWebTokenError',
        message: 'invalid signature',
      };

      expect(() => guard.handleRequest(null, false, invalidSignatureInfo)).toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw UnauthorizedException with "Invalid or expired token" when token payload is tampered', () => {
      // A tampered token (modified payload) results in a signature mismatch
      const tamperedTokenInfo = {
        name: 'JsonWebTokenError',
        message: 'invalid token',
      };

      expect(() => guard.handleRequest(null, false, tamperedTokenInfo)).toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should throw UnauthorizedException with "Invalid or expired token" when Authorization header is missing', () => {
      // When no token is provided, passport-jwt sets user=false and info is undefined
      expect(() => guard.handleRequest(null, false, undefined)).toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });

    it('should rethrow the original error when passport signals an error (not just missing user)', () => {
      const originalError = new UnauthorizedException('Custom auth error');

      expect(() => guard.handleRequest(originalError, null, null)).toThrow(originalError);
    });

    it('should throw UnauthorizedException when user is null and no error', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });
  });
});

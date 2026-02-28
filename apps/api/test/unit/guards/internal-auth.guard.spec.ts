import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InternalAuthGuard } from '../../../src/common/guards/internal-auth.guard';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;

  const VALID_SECRET = 'my-super-secret-internal-key-at-least-32-chars';
  const VALID_TOKEN = 'valid.service.jwt';

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    jwtService = {
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    guard = new InternalAuthGuard(configService, jwtService);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = { headers };
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
    it('should throw UnauthorizedException when x-internal-secret header is missing', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      const context = createMockContext({
        authorization: `Bearer ${VALID_TOKEN}`,
        // no x-internal-secret
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid internal secret');
    });

    it('should throw UnauthorizedException when x-internal-secret is wrong', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      const context = createMockContext({
        'x-internal-secret': 'wrong-secret',
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid internal secret');
    });

    it('should throw UnauthorizedException when Authorization header is missing', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        // no authorization header
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing service account token');
    });

    it('should throw UnauthorizedException when Authorization header does not start with Bearer', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Basic ${VALID_TOKEN}`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing service account token');
    });

    it('should throw UnauthorizedException when JWT verification fails', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Bearer invalid.token.here`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid service account token');
    });

    it('should throw UnauthorizedException when JWT is expired', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });
      jwtService.verify.mockImplementation(() => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid service account token');
    });

    it('should return true when both secret and JWT are valid', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });
      jwtService.verify.mockReturnValue({
        sub: 'worker-service',
        role: 'system',
        tenantId: 'system',
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith(VALID_TOKEN, { secret: 'jwt-secret' });
    });

    it('should throw UnauthorizedException when INTERNAL_API_SECRET is not configured', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return undefined;
        return undefined;
      });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Internal service not configured');
    });

    it('should throw UnauthorizedException when JWT_SECRET is not configured', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return undefined;
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 'worker-service' });

      const context = createMockContext({
        'x-internal-secret': VALID_SECRET,
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('JWT configuration error');
    });

    it('should not call jwtService.verify when secret header is invalid', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'INTERNAL_API_SECRET') return VALID_SECRET;
        if (key === 'JWT_SECRET') return 'jwt-secret';
        return undefined;
      });

      const context = createMockContext({
        'x-internal-secret': 'wrong-secret',
        authorization: `Bearer ${VALID_TOKEN}`,
      });

      try {
        guard.canActivate(context);
      } catch {
        // expected
      }

      // JWT should not be checked if secret is wrong
      expect(jwtService.verify).not.toHaveBeenCalled();
    });
  });
});

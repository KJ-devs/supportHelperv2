import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../../src/modules/auth/strategies/jwt.strategy';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { JwtPayload, UserEntity } from '../../../src/modules/auth/dto/auth.dto';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if JWT_SECRET is not defined', () => {
      const badConfigService = {
        get: jest.fn().mockReturnValue(null),
      } as any;

      expect(() => {
        new JwtStrategy(authService, badConfigService);
      }).toThrow('JWT_SECRET is not defined');
    });

    it('should initialize with JWT_SECRET from config', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate', () => {
    const mockUser: UserEntity = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'admin',
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
      },
    };

    it('should validate access token and return user', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        role: 'admin',
        type: 'access',
      };

      authService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(authService.validateUser).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for refresh token', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        role: 'admin',
        type: 'refresh',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Cannot use refresh token for authentication')
      );

      expect(authService.validateUser).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        role: 'admin',
        type: 'access',
      };

      authService.validateUser.mockResolvedValue(null as any);

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('User not found')
      );

      expect(authService.validateUser).toHaveBeenCalledWith(payload);
    });

    it('should validate token without explicit type (defaults to access)', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        role: 'owner',
      };

      authService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
    });

    it('should handle different user roles', async () => {
      const roles: Array<JwtPayload['role']> = ['owner', 'admin', 'member', 'viewer'];

      for (const role of roles) {
        const payload: JwtPayload = {
          sub: 'user-1',
          email: 'user@example.com',
          tenantId: 'tenant-1',
          role,
          type: 'access',
        };

        const userWithRole = { ...mockUser, role };
        authService.validateUser.mockResolvedValue(userWithRole);

        const result = await strategy.validate(payload);

        expect(result).toEqual(userWithRole);
      }
    });
  });
});

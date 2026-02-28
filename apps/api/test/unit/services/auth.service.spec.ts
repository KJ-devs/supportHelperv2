import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UsersService } from '../../../src/users/users.service';
import { TenantsService } from '../../../src/tenants/tenants.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;
  let tenantsService: jest.Mocked<TenantsService>;

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'member',
    passwordHash: 'hashed-password',
    authProvider: 'email',
    authProviderId: null,
    createdAt: new Date(),
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      ssoConfig: null,
    },
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'free',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'JWT_REFRESH_SECRET') {
                return 'test-refresh-secret';
              }
              if (key === 'JWT_REFRESH_EXPIRES_IN') {
                return '30d';
              }
              if (key === 'NODE_ENV') {
                return 'test';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    tenantsService = module.get(TenantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
      tenantName: 'New Tenant',
    };

    it('should register a new user successfully', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      (tenantsService.create as jest.Mock).mockResolvedValue(mockTenant);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        name: registerDto.name,
        role: 'owner',
      });
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('jwt-token');
      expect(tenantsService.create).toHaveBeenCalledWith({
        name: registerDto.tenantName,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('jwt-token');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with SSO message when tenant disables password login', async () => {
      const ssoUser = {
        ...mockUser,
        tenant: {
          id: 'tenant-123',
          slug: 'test-tenant',
          ssoConfig: {
            enabled: true,
            disablePassword: true,
            providerType: 'google',
          },
        },
      };
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(ssoUser);

      const error = await service.login(loginDto).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toContain('Password login is disabled');
      expect(error.message).toContain('SSO');
    });
  });

  describe('refresh', () => {
    const validRefreshPayload = {
      sub: 'user-123',
      tenantId: 'tenant-123',
      type: 'refresh' as const,
    };

    it('should return a new token pair for a valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(validRefreshPayload);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.sign as jest.Mock).mockReturnValue('new-jwt-token');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'new-jwt-token');
      expect(result).toHaveProperty('refreshToken', 'new-jwt-token');
      expect(result.user.id).toBe('user-123');
      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('should throw UnauthorizedException for an expired refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when access token is used as refresh token', async () => {
      // An access token payload lacks type: 'refresh'
      const accessPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        tenantId: 'tenant-123',
        role: 'member',
        // No `type` field — not a refresh token
      };
      (jwtService.verify as jest.Mock).mockReturnValue(accessPayload);

      await expect(service.refresh('access-token-used-as-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when the user no longer exists', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(validRefreshPayload);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const error = await service.refresh('valid-refresh-token').catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedException);
      // The catch block wraps the inner UnauthorizedException with a generic message
      expect(error.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('generateTokens (via login) — JWT payload', () => {
    it('should sign access token with sub, email, tenantId, role in payload', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      await service.login({ email: 'test@example.com', password: 'password123' });

      // First call to sign() is the access token
      const [accessPayload] = (jwtService.sign as jest.Mock).mock.calls[0];

      expect(accessPayload).toMatchObject({
        sub: mockUser.id,
        email: mockUser.email,
        tenantId: mockUser.tenantId,
        role: mockUser.role,
      });
    });
  });
});

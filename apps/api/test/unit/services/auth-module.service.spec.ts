import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService (modules/auth)', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

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
    updatedAt: new Date(),
    tenant: {
      id: 'tenant-123',
      name: 'Test Tenant',
      slug: 'test-tenant',
      plan: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
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

  const mockApplication = {
    id: 'app-123',
    tenantId: 'tenant-123',
    name: 'Test App',
    sdkKey: 'sdk-key-123',
    tenant: mockTenant,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      application: {
        findUnique: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRES_IN') return '7d';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    it('should register a new user and create tenant', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.create as jest.Mock).mockResolvedValue(mockTenant);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password-new');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        name: registerDto.name,
        role: 'owner',
        tenant: mockTenant,
      });
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');

      const result = await service.register(registerDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          name: registerDto.tenantName,
          slug: 'new-tenant',
          plan: 'free',
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenant.id,
          email: registerDto.email,
          name: registerDto.name,
          passwordHash: 'hashed-password-new',
          role: 'owner',
          authProvider: 'email',
        },
        include: {
          tenant: true,
        },
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token-123');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-123');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.role).toBe('owner');
    });

    it('should throw ConflictException if email already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException if tenant slug already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Tenant name already taken');
    });

    it('should generate URL-friendly slug from tenant name', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.create as jest.Mock).mockResolvedValue(mockTenant);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        tenant: mockTenant,
      });
      (jwtService.sign as jest.Mock).mockReturnValue('token');

      await service.register({
        ...registerDto,
        tenantName: 'My Cool Company!@#',
      });

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: {
          name: 'My Cool Company!@#',
          slug: 'my-cool-company',
          plan: 'free',
        },
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');

      const result = await service.login(loginDto);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        include: { tenant: true },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'access-token-123');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-123');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if user has no password hash', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    const refreshDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-123',
      role: 'member' as const,
      type: 'refresh' as const,
    };

    it('should refresh tokens with valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(mockPayload);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refresh(refreshDto);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshDto.refreshToken, {
        secret: 'test-secret',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
        include: { tenant: true },
      });

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh(refreshDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(refreshDto)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException for non-refresh token type', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        ...mockPayload,
        type: 'access',
      });

      await expect(service.refresh(refreshDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(refreshDto)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(mockPayload);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh(refreshDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(refreshDto)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('validateUser', () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-123',
      role: 'member' as const,
    };

    it('should return user for valid payload', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateUser(payload);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateUser(payload)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(payload)).rejects.toThrow('User not found');
    });
  });

  describe('validateApiKey', () => {
    it('should return application for valid API key', async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue(mockApplication);

      const result = await service.validateApiKey('sdk-key-123');

      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { sdkKey: 'sdk-key-123' },
        include: { tenant: true },
      });

      expect(result).toEqual(mockApplication);
    });

    it('should throw UnauthorizedException for invalid API key', async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateApiKey('invalid-key')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateApiKey('invalid-key')).rejects.toThrow('Invalid API key');
    });
  });
});

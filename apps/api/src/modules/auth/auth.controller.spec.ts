import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-id',
    tenantId: 'tenant-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'owner',
    passwordHash: 'hashed',
    authProvider: 'email',
    authProviderId: null,
    createdAt: new Date(),
    tenant: {
      id: 'tenant-id',
      name: 'Test Tenant',
      slug: 'test-tenant',
      plan: 'free',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAuthResponse = {
    user: {
      id: mockUser.id,
      tenantId: mockUser.tenantId,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role as any,
      createdAt: mockUser.createdAt,
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
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
            tenant: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_EXPIRES_IN') return '7d';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
      tenantName: 'New Tenant',
    };

    it('should register a new user successfully', async () => {
      const newTenant = {
        id: 'new-tenant-id',
        name: registerDto.tenantName,
        slug: 'new-tenant',
        plan: 'free',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newUser = {
        ...mockUser,
        id: 'new-user-id',
        tenantId: newTenant.id,
        email: registerDto.email,
        name: registerDto.name,
        tenant: newTenant,
      };

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'create').mockResolvedValue(newTenant as any);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(newUser as any);

      const result = await controller.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw ConflictException if email exists', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser as any);

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if tenant slug exists', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockUser.tenant as any);

      await expect(controller.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException with invalid credentials', async () => {
      jest
        .spyOn(authService, 'login')
        .mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const refreshDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh token successfully', async () => {
      jest.spyOn(authService, 'refresh').mockResolvedValue(mockAuthResponse);

      const result = await controller.refresh(refreshDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException with invalid refresh token', async () => {
      jest
        .spyOn(authService, 'refresh')
        .mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refresh(refreshDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('should return current user info', async () => {
      const result = await controller.getMe(mockUser as any);

      expect(result).toHaveProperty('id', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('tenantId', mockUser.tenantId);
      expect(result).toHaveProperty('tenant');
      expect(result.tenant).toHaveProperty('name', mockUser.tenant.name);
    });
  });
});

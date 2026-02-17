import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '@/modules/auth/auth.service';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Auth Flow Integration Tests
 *
 * Tests the complete authentication lifecycle:
 * register -> login -> refresh -> validateUser -> validateApiKey
 *
 * Uses mocked Prisma but real JWT + bcrypt to verify token flow integrity.
 */
describe('Auth Flow Integration', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    tenant: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    application: {
      findUnique: jest.Mock;
    };
  };

  const JWT_SECRET = 'test-jwt-secret-for-integration-tests';

  const mockTenant = {
    id: 'tenant-001',
    name: 'Test Org',
    slug: 'test-org',
    plan: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-001',
    tenantId: 'tenant-001',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '', // Set in beforeEach
    role: 'owner',
    authProvider: 'email',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: mockTenant,
  };

  beforeEach(async () => {
    // Hash a real password for realistic flow testing
    mockUser.passwordHash = await bcrypt.hash('SecurePass123!', 10);

    prisma = {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useFactory: () =>
            new JwtService({
              secret: JWT_SECRET,
              signOptions: { expiresIn: '7d' },
            }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                JWT_SECRET,
                JWT_EXPIRES_IN: '7d',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register -> login -> refresh flow', () => {
    it('should register a new user and return valid tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // No existing user
      prisma.tenant.findUnique.mockResolvedValue(null); // No existing slug
      prisma.tenant.create.mockResolvedValue(mockTenant);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
        tenantName: 'Test Org',
      });

      // Verify response structure
      expect(result.user.id).toBe('user-001');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('owner');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify tokens are valid JWT
      const accessPayload = jwtService.verify(result.accessToken, {
        secret: JWT_SECRET,
      });
      expect(accessPayload.sub).toBe('user-001');
      expect(accessPayload.email).toBe('test@example.com');
      expect(accessPayload.tenantId).toBe('tenant-001');
      expect(accessPayload.type).toBe('access');

      const refreshPayload = jwtService.verify(result.refreshToken, {
        secret: JWT_SECRET,
      });
      expect(refreshPayload.sub).toBe('user-001');
      expect(refreshPayload.type).toBe('refresh');
    });

    it('should login with correct password and return valid tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(result.user.id).toBe('user-001');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Access token should be verifiable
      const payload = jwtService.verify(result.accessToken, {
        secret: JWT_SECRET,
      });
      expect(payload.sub).toBe('user-001');
    });

    it('should refresh access token using valid refresh token', async () => {
      // First, login to get tokens
      prisma.user.findFirst.mockResolvedValue(mockUser);
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Now use the refresh token to get new tokens
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const refreshResult = await authService.refresh({
        refreshToken: loginResult.refreshToken,
      });

      expect(refreshResult.user.id).toBe('user-001');
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();

      // New access token should be different from the old one
      // (they have different iat timestamps)
      const newPayload = jwtService.verify(refreshResult.accessToken, {
        secret: JWT_SECRET,
      });
      expect(newPayload.sub).toBe('user-001');
    });

    it('should complete full flow: register -> login -> refresh -> validateUser', async () => {
      // Step 1: Register
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue(mockTenant);
      prisma.user.create.mockResolvedValue(mockUser);

      const registerResult = await authService.register({
        email: 'flow@example.com',
        password: 'FlowTest123!',
        name: 'Flow User',
        tenantName: 'Flow Org',
      });

      // Step 2: Login with same credentials
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash('FlowTest123!', 10),
      });

      const loginResult = await authService.login({
        email: 'flow@example.com',
        password: 'FlowTest123!',
      });

      // Step 3: Refresh token
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const refreshResult = await authService.refresh({
        refreshToken: loginResult.refreshToken,
      });

      // Step 4: Validate user from access token payload
      const payload = jwtService.verify(refreshResult.accessToken, {
        secret: JWT_SECRET,
      });

      prisma.user.findUnique.mockResolvedValue(mockUser);
      const validatedUser = await authService.validateUser(payload);

      expect(validatedUser.id).toBe('user-001');
      expect(validatedUser.tenantId).toBe('tenant-001');
    });
  });

  describe('auth error flows', () => {
    it('should reject registration with duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'SecurePass123!',
          tenantName: 'Another Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject registration with duplicate tenant slug', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        authService.register({
          email: 'new@example.com',
          password: 'SecurePass123!',
          tenantName: 'Test Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject login with wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'SomePass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with invalid token', async () => {
      await expect(
        authService.refresh({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with access token (wrong type)', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Try to use access token as refresh token - should fail
      await expect(
        authService.refresh({ refreshToken: loginResult.accessToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh when user no longer exists', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // User deleted between login and refresh
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh({ refreshToken: loginResult.refreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('API key validation flow', () => {
    it('should validate a valid SDK key', async () => {
      const mockApp = {
        id: 'app-001',
        tenantId: 'tenant-001',
        name: 'Test App',
        sdkKey: 'sk_test_abc123',
        tenant: mockTenant,
      };
      prisma.application.findUnique.mockResolvedValue(mockApp);

      const result = await authService.validateApiKey('sk_test_abc123');

      expect(result.id).toBe('app-001');
      expect(result.tenant.id).toBe('tenant-001');
    });

    it('should reject invalid SDK key', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateApiKey('sk_invalid_key'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

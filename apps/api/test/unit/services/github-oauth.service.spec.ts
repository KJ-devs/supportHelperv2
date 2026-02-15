import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GithubOAuthService } from '../../../src/modules/github/services/github-oauth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({
        data: { id: 12345, login: 'testuser', email: 'test@example.com', name: 'Test User' },
      }),
      listEmailsForAuthenticatedUser: jest.fn().mockResolvedValue({
        data: [{ email: 'primary@example.com', primary: true }],
      }),
    },
    repos: {
      listWebhooks: jest.fn().mockResolvedValue({ data: [] }),
      createWebhook: jest.fn().mockResolvedValue({ data: { id: 1 } }),
    },
  })),
}));

describe('GithubOAuthService', () => {
  let service: GithubOAuthService;
  let prisma: jest.Mocked<PrismaService>;

  const configValues: Record<string, any> = {
    'github.clientId': 'test-client-id',
    'github.clientSecret': 'test-client-secret',
    'github.enabled': true,
    'github.webhookSecret': 'test-webhook-secret-32chars-long!',
    'app.apiUrl': 'http://localhost:3001',
    'app.dashboardUrl': 'http://localhost:3000',
  };

  // Mock data simulates values after Prisma middleware auto-decryption
  const mockConnection = {
    id: 'conn-123',
    tenantId: 'tenant-123',
    installationId: BigInt(0),
    accessToken: 'gho_test',
    refreshToken: 'refresh_token',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    repos: ['owner/repo'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubOAuthService,
        {
          provide: PrismaService,
          useValue: {
            githubConnection: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    service = module.get<GithubOAuthService>(GithubOAuthService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('generateStateToken / verifyStateToken', () => {
    it('should generate and verify a valid state token', () => {
      const state = service.generateStateToken('tenant-123', '/redirect');
      const payload = service.verifyStateToken(state);

      expect(payload.tenantId).toBe('tenant-123');
      expect(payload.redirectUri).toBe('/redirect');
      expect(payload.timestamp).toBeDefined();
      expect(payload.nonce).toBeDefined();
    });

    it('should throw BadRequestException for invalid state', () => {
      expect(() => service.verifyStateToken('invalid-state')).toThrow(BadRequestException);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return url and state', () => {
      const result = service.getAuthorizationUrl('tenant-123');

      expect(result.url).toContain('https://github.com/login/oauth/authorize');
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.state).toBeDefined();
    });
  });

  describe('saveConnection', () => {
    it('should create new connection when none exists', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.githubConnection.create as jest.Mock).mockResolvedValue(mockConnection);

      await service.saveConnection('tenant-123', 'gho_token', BigInt(0));

      // Plaintext tokens are passed; Prisma middleware auto-encrypts on write
      expect(prisma.githubConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accessToken: 'gho_token' }),
      });
    });

    it('should update existing connection', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.githubConnection.update as jest.Mock).mockResolvedValue(mockConnection);

      await service.saveConnection('tenant-123', 'new_token');

      // Plaintext tokens are passed; Prisma middleware auto-encrypts on write
      expect(prisma.githubConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({ accessToken: 'new_token' }),
      });
    });
  });

  describe('getConnection', () => {
    it('should return connection for tenant', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(mockConnection);

      const result = await service.getConnection('tenant-123');

      expect(result).toEqual(mockConnection);
      expect(prisma.githubConnection.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'tenant-123' } });
    });

    it('should return null when no connection', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getConnection('tenant-123');

      expect(result).toBeNull();
    });
  });

  describe('deleteConnection', () => {
    it('should delete existing connection', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(mockConnection);
      (prisma.githubConnection.delete as jest.Mock).mockResolvedValue(mockConnection);

      await service.deleteConnection('tenant-123');

      expect(prisma.githubConnection.delete).toHaveBeenCalledWith({ where: { id: 'conn-123' } });
    });

    it('should do nothing if no connection exists', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(null);

      await service.deleteConnection('tenant-123');

      expect(prisma.githubConnection.delete).not.toHaveBeenCalled();
    });
  });

  describe('getOctokitForTenant', () => {
    it('should return Octokit when connection exists with valid token', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(mockConnection);

      const octokit = await service.getOctokitForTenant('tenant-123');

      expect(octokit).toBeDefined();
    });

    it('should throw UnauthorizedException when no connection', async () => {
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getOctokitForTenant('tenant-123')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token expired', async () => {
      const expiredConnection = {
        ...mockConnection,
        tokenExpiresAt: new Date(Date.now() - 86400000),
        refreshToken: 'rt',
      };
      (prisma.githubConnection.findFirst as jest.Mock).mockResolvedValue(expiredConnection);

      await expect(service.getOctokitForTenant('tenant-123')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return user info', async () => {
      const user = await service.getAuthenticatedUser('test-token');

      expect(user).toEqual({
        id: 12345,
        login: 'testuser',
        email: 'primary@example.com',
        name: 'Test User',
      });
    });
  });
});

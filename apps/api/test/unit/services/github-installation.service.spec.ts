// Mock @octokit/rest BEFORE all imports (ESM compat)
// The service creates `new Octokit({ auth: jwt })` internally for GitHub API calls.
// We return an object with apps.getInstallation so those calls succeed.
const mockOctokitInstance = {
  apps: {
    getInstallation: jest.fn(),
    listInstallations: jest.fn(),
  },
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokitInstance),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GithubInstallationService } from '../../../src/modules/github/services/github-installation.service';
import { GithubAppService } from '../../../src/modules/github/services/github-app.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('GithubInstallationService', () => {
  let service: GithubInstallationService;
  let prisma: jest.Mocked<PrismaService>;
  let appService: jest.Mocked<GithubAppService>;

  const mockInstallation = {
    id: 'inst-uuid-1',
    tenantId: 'tenant-123',
    installationId: BigInt(987654),
    accountLogin: 'my-org',
    accountType: 'Organization',
    permissions: {},
    suspendedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: apps.getInstallation succeeds with mock GitHub data
    mockOctokitInstance.apps.getInstallation.mockResolvedValue({
      data: {
        account: { login: 'my-org', type: 'Organization' },
        permissions: { issues: 'write' },
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubInstallationService,
        {
          provide: PrismaService,
          useValue: {
            githubInstallation: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            projectGithubConfig: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'github.appName' ? 'my-github-app' : undefined,
            ),
          },
        },
        {
          provide: GithubAppService,
          useValue: {
            getInstallationOctokit: jest.fn(),
            invalidateInstallationToken: jest.fn(),
            generateAppJwt: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<GithubInstallationService>(GithubInstallationService);
    prisma = module.get(PrismaService);
    appService = module.get(GithubAppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getInstallUrl ────────────────────────────────────────────────────────

  describe('getInstallUrl', () => {
    it('should return an install URL with the tenantId as state', () => {
      const url = service.getInstallUrl('tenant-123');

      expect(url).toBe(
        'https://github.com/apps/my-github-app/installations/new?state=tenant-123',
      );
    });

    it('should include the tenantId in the URL', () => {
      const url = service.getInstallUrl('tenant-abc');

      expect(url).toContain('tenant-abc');
    });
  });

  // ─── handleInstallationCallback ──────────────────────────────────────────

  describe('handleInstallationCallback', () => {
    it('should create a new installation record', async () => {
      (prisma.githubInstallation.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.githubInstallation.create as jest.Mock).mockResolvedValue(mockInstallation);

      const result = await service.handleInstallationCallback(987654, 'tenant-123');

      expect(prisma.githubInstallation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          installationId: BigInt(987654),
        }),
      });
      expect(result).toEqual(mockInstallation);
    });

    it('should update existing installation for the same tenant', async () => {
      (prisma.githubInstallation.findUnique as jest.Mock).mockResolvedValue(mockInstallation);
      (prisma.githubInstallation.update as jest.Mock).mockResolvedValue(mockInstallation);

      await service.handleInstallationCallback(987654, 'tenant-123');

      expect(prisma.githubInstallation.update).toHaveBeenCalledWith({
        where: { id: 'inst-uuid-1' },
        data: expect.objectContaining({
          suspendedAt: null,
        }),
      });
    });

    it('should throw ConflictException when installation belongs to a different tenant', async () => {
      const otherTenantInstallation = { ...mockInstallation, tenantId: 'other-tenant' };
      (prisma.githubInstallation.findUnique as jest.Mock).mockResolvedValue(
        otherTenantInstallation,
      );

      await expect(
        service.handleInstallationCallback(987654, 'tenant-123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── getInstallations ─────────────────────────────────────────────────────

  describe('getInstallations', () => {
    it('should return installations for the given tenant', async () => {
      (prisma.githubInstallation.findMany as jest.Mock).mockResolvedValue([mockInstallation]);

      const result = await service.getInstallations('tenant-123');

      expect(result).toEqual([mockInstallation]);
      expect(prisma.githubInstallation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no installations found', async () => {
      (prisma.githubInstallation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getInstallations('tenant-123');

      expect(result).toEqual([]);
    });
  });

  // ─── getInstallation ──────────────────────────────────────────────────────

  describe('getInstallation', () => {
    it('should return the installation when found', async () => {
      (prisma.githubInstallation.findFirst as jest.Mock).mockResolvedValue(mockInstallation);

      const result = await service.getInstallation('inst-uuid-1', 'tenant-123');

      expect(result).toEqual(mockInstallation);
    });

    it('should throw NotFoundException when installation not found', async () => {
      (prisma.githubInstallation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getInstallation('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── removeInstallation ───────────────────────────────────────────────────

  describe('removeInstallation', () => {
    it('should delete the installation and invalidate the cached token', async () => {
      (prisma.githubInstallation.findFirst as jest.Mock).mockResolvedValue(mockInstallation);
      (prisma.githubInstallation.delete as jest.Mock).mockResolvedValue(mockInstallation);
      (appService.invalidateInstallationToken as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeInstallation('inst-uuid-1', 'tenant-123');

      expect(appService.invalidateInstallationToken).toHaveBeenCalledWith(987654);
      expect(prisma.githubInstallation.delete).toHaveBeenCalledWith({
        where: { id: 'inst-uuid-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when installation not found', async () => {
      (prisma.githubInstallation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.removeInstallation('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

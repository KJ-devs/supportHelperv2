import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../../../src/modules/license/license.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('LicenseService - System Endpoints', () => {
  let service: LicenseService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
    },
    licenseUsage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'LICENSE_KEY') return null;
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('getVersionInfo', () => {
    it('should return version information', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          migration_name: '20260216220000_add_license_usage',
          finished_at: new Date(),
        },
      ]);

      const result = await service.getVersionInfo();

      expect(result).toHaveProperty('current');
      expect(result).toHaveProperty('dbVersion');
      expect(result).toHaveProperty('dbCompatible');
      expect(result).toHaveProperty('nodeVersion');
      expect(result).toHaveProperty('uptime');
      expect(result.nodeVersion).toBe(process.version);
      expect(typeof result.uptime).toBe('number');
      expect(result.dbVersion).toBe('20260216220000_add_license_usage');
      expect(result.dbCompatible).toBe(true);
    });

    it('should handle missing migrations table', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Table does not exist'),
      );

      const result = await service.getVersionInfo();

      expect(result.dbVersion).toBeNull();
      expect(result.dbCompatible).toBe(false);
    });

    it('should handle no migrations', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getVersionInfo();

      expect(result.dbVersion).toBeNull();
      expect(result.dbCompatible).toBe(false);
    });
  });

  describe('getLatestChangelog', () => {
    it('should return changelog entry from system config', async () => {
      const changelog = {
        version: '0.1.0',
        date: '2026-02-16',
        changes: [
          'Added setup wizard (US-7.3)',
          'Added license verification (US-9.1)',
        ],
      };

      mockPrismaService.systemConfig.findUnique.mockResolvedValue({
        key: 'latest_changelog',
        value: changelog,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getLatestChangelog();

      expect(result).toEqual({
        version: '0.1.0',
        date: '2026-02-16',
        changes: [
          'Added setup wizard (US-7.3)',
          'Added license verification (US-9.1)',
        ],
        dismissed: false,
      });
    });

    it('should return null when no changelog exists', async () => {
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.getLatestChangelog();

      expect(result).toBeNull();
    });

    it('should handle invalid changelog value', async () => {
      mockPrismaService.systemConfig.findUnique.mockResolvedValue({
        key: 'latest_changelog',
        value: 'invalid',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getLatestChangelog();

      expect(result).toBeNull();
    });
  });

  describe('dismissChangelogForUser', () => {
    it('should create dismiss record for user', async () => {
      const userId = 'user-123';
      mockPrismaService.systemConfig.upsert.mockResolvedValue({
        key: `changelog_dismissed_${userId}`,
        value: { dismissed: true, timestamp: expect.any(String) },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.dismissChangelogForUser(userId);

      expect(mockPrismaService.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: `changelog_dismissed_${userId}` },
        create: {
          key: `changelog_dismissed_${userId}`,
          value: {
            dismissed: true,
            timestamp: expect.any(String),
          },
        },
        update: {
          value: {
            dismissed: true,
            timestamp: expect.any(String),
          },
        },
      });
    });
  });
});

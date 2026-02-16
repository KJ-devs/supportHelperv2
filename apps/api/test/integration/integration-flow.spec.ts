import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { IntegrationsCryptoService } from '@/modules/integrations/integrations-crypto.service';

/**
 * Integration Flow Integration Tests
 *
 * Tests the complete third-party integration lifecycle:
 * create -> findAll -> update -> testConnection -> getSyncLogs -> delete
 *
 * Uses a real crypto service (with test key) and mocked Prisma to verify
 * encryption/decryption round-trip, validation, and CRUD operations.
 */

// Mock the integration providers at module level
jest.mock('@/modules/integrations/providers', () => {
  const mockProvider = {
    type: 'jira',
    name: 'Jira',
    description: 'Jira integration',
    requiredConfig: ['baseUrl', 'email', 'apiToken'],
    optionalConfig: ['projectKey'],
    supportsOAuth: false,
    validateConfig: jest.fn().mockResolvedValue({ valid: true }),
    testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
  };

  class MockJiraProvider {
    type = mockProvider.type;
    name = mockProvider.name;
    description = mockProvider.description;
    requiredConfig = mockProvider.requiredConfig;
    optionalConfig = mockProvider.optionalConfig;
    supportsOAuth = mockProvider.supportsOAuth;
    validateConfig = mockProvider.validateConfig;
    testConnection = mockProvider.testConnection;
  }

  return {
    INTEGRATION_PROVIDERS: {
      jira: MockJiraProvider,
    },
    __mockProvider: mockProvider,
  };
});

const { __mockProvider: mockProvider } = require('@/modules/integrations/providers');

describe('Integration Flow', () => {
  let service: IntegrationsService;
  let cryptoService: IntegrationsCryptoService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const tenantId = 'tenant-001';
  const TEST_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 byte key

  beforeEach(async () => {
    prisma = {
      integration: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      integrationSyncLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    mockProvider.validateConfig.mockReset();
    mockProvider.validateConfig.mockResolvedValue({ valid: true });
    mockProvider.testConnection.mockReset();
    mockProvider.testConnection.mockResolvedValue({ success: true, message: 'Connected' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: IntegrationsCryptoService,
          useFactory: () => {
            // Create a real crypto service with test key
            const { ConfigService } = require('@nestjs/config');
            const configService = new ConfigService({
              INTEGRATION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            });
            return new IntegrationsCryptoService(configService);
          },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    cryptoService = module.get<IntegrationsCryptoService>(IntegrationsCryptoService);
  });

  describe('create -> findOne -> update -> delete flow', () => {
    it('should create integration with encrypted config', async () => {
      const config = {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'secret-token-123',
      };

      prisma.integration.findUnique.mockResolvedValue(null); // No duplicate

      // Capture the encrypted data passed to Prisma
      let savedData: any = null;
      prisma.integration.create.mockImplementation(async (args: any) => {
        savedData = args.data;
        return {
          id: 'int-001',
          tenantId,
          type: 'jira',
          name: 'My Jira',
          enabled: true,
          config: savedData.config,
          configIv: savedData.configIv,
          mappings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { syncLogs: 0 },
        };
      });

      const result = await service.create(tenantId, {
        type: 'jira',
        name: 'My Jira',
        enabled: true,
        config,
      });

      // Config should be decrypted in the response
      expect(result.config).toEqual(config);
      expect(result.configIv).toBeUndefined();
      expect(result.name).toBe('My Jira');

      // The stored config should be encrypted (not plaintext)
      expect(savedData.config).not.toContain('secret-token-123');

      // Verify round-trip: decrypt the stored data
      const decrypted = JSON.parse(
        cryptoService.decrypt(savedData.config, savedData.configIv),
      );
      expect(decrypted).toEqual(config);
    });

    it('should reject duplicate integration', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'int-existing',
        tenantId,
        type: 'jira',
        name: 'My Jira',
      });

      await expect(
        service.create(tenantId, {
          type: 'jira',
          name: 'My Jira',
          enabled: true,
          config: { baseUrl: 'test', email: 'test', apiToken: 'test' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject invalid config', async () => {
      mockProvider.validateConfig.mockResolvedValue({
        valid: false,
        errors: ['baseUrl is required'],
      });
      prisma.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.create(tenantId, {
          type: 'jira',
          name: 'Bad Jira',
          enabled: true,
          config: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown integration type', async () => {
      await expect(
        service.create(tenantId, {
          type: 'unknown-provider',
          name: 'Bad',
          enabled: true,
          config: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should find integration by ID with decrypted config', async () => {
      const encrypted = cryptoService.encrypt(
        JSON.stringify({ baseUrl: 'https://test.atlassian.net', apiToken: 'secret' }),
      );

      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
        type: 'jira',
        name: 'My Jira',
        enabled: true,
        config: encrypted.ciphertext,
        configIv: encrypted.iv,
        _count: { syncLogs: 5 },
      });

      const result = await service.findOne('int-001', tenantId);

      expect(result.config.apiToken).toBe('secret');
      expect(result.configIv).toBeUndefined();
    });

    it('should return 404 for non-existent integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update integration and re-encrypt config', async () => {
      const oldEncrypted = cryptoService.encrypt(
        JSON.stringify({ baseUrl: 'old', email: 'old', apiToken: 'old-secret' }),
      );

      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
        type: 'jira',
        name: 'My Jira',
        config: oldEncrypted.ciphertext,
        configIv: oldEncrypted.iv,
      });

      let updatedData: any = null;
      prisma.integration.update.mockImplementation(async (args: any) => {
        updatedData = args.data;
        return {
          id: 'int-001',
          tenantId,
          type: 'jira',
          name: 'Updated Jira',
          enabled: true,
          config: updatedData.config,
          configIv: updatedData.configIv,
          mappings: {},
          _count: { syncLogs: 5 },
        };
      });

      const newConfig = {
        baseUrl: 'https://new.atlassian.net',
        email: 'new@test.com',
        apiToken: 'new-secret-456',
      };

      const result = await service.update('int-001', tenantId, {
        name: 'Updated Jira',
        config: newConfig,
      });

      expect(result.name).toBe('Updated Jira');
      expect(result.config).toEqual(newConfig);

      // Verify the stored data is re-encrypted with new values
      const decrypted = JSON.parse(
        cryptoService.decrypt(updatedData.config, updatedData.configIv),
      );
      expect(decrypted.apiToken).toBe('new-secret-456');
    });

    it('should delete integration', async () => {
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
      });
      prisma.integration.delete.mockResolvedValue({});

      await service.delete('int-001', tenantId);

      expect(prisma.integration.delete).toHaveBeenCalledWith({
        where: { id: 'int-001' },
      });
    });

    it('should reject delete for non-existent integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('test connection flow', () => {
    it('should test connection with decrypted config', async () => {
      const encrypted = cryptoService.encrypt(
        JSON.stringify({ baseUrl: 'https://test.atlassian.net', apiToken: 'secret' }),
      );

      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
        type: 'jira',
        name: 'My Jira',
        config: encrypted.ciphertext,
        configIv: encrypted.iv,
        _count: { syncLogs: 0 },
      });

      const result = await service.testConnection('int-001', tenantId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected');

      // The provider should receive decrypted config
      expect(mockProvider.testConnection).toHaveBeenCalledWith(
        expect.objectContaining({ apiToken: 'secret' }),
      );
    });

    it('should return failure for failed connection test', async () => {
      mockProvider.testConnection.mockResolvedValue({
        success: false,
        message: 'Authentication failed',
      });

      const encrypted = cryptoService.encrypt(JSON.stringify({ apiToken: 'bad-token' }));

      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
        type: 'jira',
        name: 'My Jira',
        config: encrypted.ciphertext,
        configIv: encrypted.iv,
        _count: { syncLogs: 0 },
      });

      const result = await service.testConnection('int-001', tenantId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed');
    });
  });

  describe('sync logs and stats', () => {
    it('should retrieve sync logs with pagination', async () => {
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
      });

      const mockLogs = [
        {
          id: 'log-1',
          status: 'success',
          action: 'create',
          durationMs: 150,
          syncedAt: new Date(),
          ticket: { id: 'ticket-1', title: 'Bug', status: 'new' },
        },
        {
          id: 'log-2',
          status: 'failed',
          action: 'update',
          durationMs: 300,
          syncedAt: new Date(),
          error: 'API rate limit exceeded',
          ticket: { id: 'ticket-2', title: 'Feature', status: 'open' },
        },
      ];

      prisma.integrationSyncLog.findMany.mockResolvedValue(mockLogs);
      prisma.integrationSyncLog.count.mockResolvedValue(10);

      const result = await service.getSyncLogs('int-001', tenantId, {
        page: 0,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(0);
      expect(result.limit).toBe(2);
    });

    it('should filter sync logs by status', async () => {
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
      });
      prisma.integrationSyncLog.findMany.mockResolvedValue([]);
      prisma.integrationSyncLog.count.mockResolvedValue(0);

      await service.getSyncLogs('int-001', tenantId, { status: 'failed' });

      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integrationId: 'int-001',
            status: 'failed',
          }),
        }),
      );
    });

    it('should compute sync stats correctly', async () => {
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
      });

      prisma.integrationSyncLog.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // success
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(5); // retrying
      prisma.integrationSyncLog.findMany.mockResolvedValue([]);

      const stats = await service.getSyncStats('int-001', tenantId);

      expect(stats.total).toBe(100);
      expect(stats.success).toBe(85);
      expect(stats.failed).toBe(10);
      expect(stats.retrying).toBe(5);
      expect(stats.successRate).toBe(85);
    });

    it('should handle zero sync stats gracefully', async () => {
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-001',
        tenantId,
      });

      prisma.integrationSyncLog.count.mockResolvedValue(0);
      prisma.integrationSyncLog.findMany.mockResolvedValue([]);

      const stats = await service.getSyncStats('int-001', tenantId);

      expect(stats.total).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('multi-tenant isolation', () => {
    it('should not find integration from another tenant', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('int-001', 'other-tenant'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete integration from another tenant', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('int-001', 'other-tenant'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter integrations by tenantId', async () => {
      prisma.integration.findMany.mockResolvedValue([]);

      await service.findAll(tenantId);

      expect(prisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId }),
        }),
      );
    });
  });

  describe('complete lifecycle', () => {
    it('should perform full create -> test -> sync -> update -> delete cycle', async () => {
      const config = {
        baseUrl: 'https://test.atlassian.net',
        email: 'admin@test.com',
        apiToken: 'initial-token',
      };

      // Step 1: Create
      prisma.integration.findUnique.mockResolvedValue(null);
      let storedConfig = '';
      let storedIv = '';
      prisma.integration.create.mockImplementation(async (args: any) => {
        storedConfig = args.data.config;
        storedIv = args.data.configIv;
        return {
          id: 'int-lifecycle',
          tenantId,
          type: 'jira',
          name: 'Lifecycle Jira',
          enabled: true,
          config: storedConfig,
          configIv: storedIv,
          mappings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { syncLogs: 0 },
        };
      });

      const created = await service.create(tenantId, {
        type: 'jira',
        name: 'Lifecycle Jira',
        enabled: true,
        config,
      });
      expect(created.config.apiToken).toBe('initial-token');

      // Step 2: Test connection
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-lifecycle',
        tenantId,
        type: 'jira',
        name: 'Lifecycle Jira',
        config: storedConfig,
        configIv: storedIv,
        _count: { syncLogs: 0 },
      });

      const testResult = await service.testConnection('int-lifecycle', tenantId);
      expect(testResult.success).toBe(true);

      // Step 3: Check sync stats
      prisma.integrationSyncLog.count.mockResolvedValue(0);
      prisma.integrationSyncLog.findMany.mockResolvedValue([]);

      const stats = await service.getSyncStats('int-lifecycle', tenantId);
      expect(stats.total).toBe(0);

      // Step 4: Update config
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-lifecycle',
        tenantId,
        type: 'jira',
        name: 'Lifecycle Jira',
        config: storedConfig,
        configIv: storedIv,
      });

      prisma.integration.update.mockImplementation(async (args: any) => {
        storedConfig = args.data.config;
        storedIv = args.data.configIv;
        return {
          id: 'int-lifecycle',
          tenantId,
          type: 'jira',
          name: 'Lifecycle Jira v2',
          enabled: true,
          config: storedConfig,
          configIv: storedIv,
          mappings: {},
          _count: { syncLogs: 0 },
        };
      });

      const updated = await service.update('int-lifecycle', tenantId, {
        name: 'Lifecycle Jira v2',
        config: { ...config, apiToken: 'updated-token' },
      });
      expect(updated.config.apiToken).toBe('updated-token');

      // Step 5: Delete
      prisma.integration.findFirst.mockResolvedValue({
        id: 'int-lifecycle',
        tenantId,
      });
      prisma.integration.delete.mockResolvedValue({});

      await service.delete('int-lifecycle', tenantId);
      expect(prisma.integration.delete).toHaveBeenCalledWith({
        where: { id: 'int-lifecycle' },
      });
    });
  });
});

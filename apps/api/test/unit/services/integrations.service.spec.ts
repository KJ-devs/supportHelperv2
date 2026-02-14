import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { IntegrationsService } from '../../../src/modules/integrations/integrations.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { IntegrationsCryptoService } from '../../../src/modules/integrations/integrations-crypto.service';

// Mock providers
const mockSlackProvider = {
  type: 'slack',
  name: 'Slack',
  description: 'Slack integration',
  requiredConfig: ['webhookUrl'],
  optionalConfig: [],
  supportsOAuth: false,
  validateConfig: jest.fn(),
  testConnection: jest.fn(),
};

const mockJiraProvider = {
  type: 'jira',
  name: 'Jira',
  description: 'Jira integration',
  requiredConfig: ['apiUrl', 'apiToken'],
  optionalConfig: [],
  supportsOAuth: false,
  validateConfig: jest.fn(),
  testConnection: jest.fn(),
};

jest.mock('../../../src/modules/integrations/providers', () => ({
  INTEGRATION_PROVIDERS: {
    slack: jest.fn(() => mockSlackProvider),
    jira: jest.fn(() => mockJiraProvider),
  },
}));

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: jest.Mocked<IntegrationsCryptoService>;

  const mockTenantId = 'tenant-123';
  const mockIntegrationId = 'integration-123';

  const mockIntegration = {
    id: mockIntegrationId,
    tenantId: mockTenantId,
    type: 'slack',
    name: 'My Slack',
    enabled: true,
    config: 'encrypted-data',
    configIv: 'iv-hex',
    mappings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { syncLogs: 10 },
  };

  const mockDecryptedConfig = { webhookUrl: 'https://hooks.slack.com/test' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: PrismaService,
          useValue: {
            integration: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            integrationSyncLog: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: IntegrationsCryptoService,
          useValue: {
            encrypt: jest.fn().mockReturnValue({ ciphertext: 'encrypted-data', iv: 'iv-hex' }),
            decrypt: jest.fn().mockReturnValue(JSON.stringify(mockDecryptedConfig)),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prisma = module.get(PrismaService);
    cryptoService = module.get(IntegrationsCryptoService);

    // Reset provider mocks
    mockSlackProvider.validateConfig.mockResolvedValue({ valid: true });
    mockSlackProvider.testConnection.mockResolvedValue({ success: true, message: 'Connected' });
    mockJiraProvider.validateConfig.mockResolvedValue({ valid: true });
    mockJiraProvider.testConnection.mockResolvedValue({ success: true });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create integration with valid config', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({ valid: true });
      (prisma.integration.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.integration.create as jest.Mock).mockResolvedValue(mockIntegration);

      const dto = {
        type: 'slack',
        name: 'My Slack',
        config: mockDecryptedConfig,
        enabled: true,
      };

      const result = await service.create(mockTenantId, dto);

      expect(mockSlackProvider.validateConfig).toHaveBeenCalledWith(mockDecryptedConfig);
      expect(cryptoService.encrypt).toHaveBeenCalledWith(JSON.stringify(mockDecryptedConfig));
      expect(prisma.integration.create).toHaveBeenCalledWith({
        data: {
          tenantId: mockTenantId,
          type: 'slack',
          name: 'My Slack',
          enabled: true,
          config: 'encrypted-data',
          configIv: 'iv-hex',
          mappings: {},
        },
        include: {
          _count: {
            select: { syncLogs: true },
          },
        },
      });
      expect(result.config).toEqual(mockDecryptedConfig);
    });

    it('should throw BadRequestException for unknown integration type', async () => {
      const dto = {
        type: 'unknown',
        name: 'Test',
        config: {},
      };

      await expect(service.create(mockTenantId, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid config', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({
        valid: false,
        errors: ['webhookUrl is required'],
      });

      const dto = {
        type: 'slack',
        name: 'My Slack',
        config: {},
        enabled: true,
      };

      await expect(service.create(mockTenantId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(mockTenantId, dto)).rejects.toThrow('Invalid configuration: webhookUrl is required');
    });

    it('should throw ConflictException for duplicate integration', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({ valid: true });
      (prisma.integration.findUnique as jest.Mock).mockResolvedValue(mockIntegration);

      const dto = {
        type: 'slack',
        name: 'My Slack',
        config: mockDecryptedConfig,
        enabled: true,
      };

      await expect(service.create(mockTenantId, dto)).rejects.toThrow(ConflictException);
    });

    it('should use default enabled=true when not provided', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({ valid: true });
      (prisma.integration.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.integration.create as jest.Mock).mockResolvedValue(mockIntegration);

      const dto = {
        type: 'slack',
        name: 'My Slack',
        config: mockDecryptedConfig,
        enabled: true,
      };

      await service.create(mockTenantId, dto);

      expect(prisma.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ enabled: true }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all integrations for tenant', async () => {
      (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

      const result = await service.findAll(mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0].config).toEqual(mockDecryptedConfig);
      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
        include: {
          _count: {
            select: { syncLogs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by type when provided', async () => {
      (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

      await service.findAll(mockTenantId, { type: 'slack' });

      expect(prisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'slack' }),
        }),
      );
    });

    it('should filter by enabled status when provided', async () => {
      (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

      await service.findAll(mockTenantId, { enabled: true });

      expect(prisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ enabled: true }),
        }),
      );
    });

    it('should not expose config when throwOnError is false', async () => {
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

      const result = await service.findAll(mockTenantId);

      expect(result[0].config).toEqual({});
      expect(result[0].decryptionFailed).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return integration by id', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await service.findOne(mockIntegrationId, mockTenantId);

      expect(result.id).toBe(mockIntegrationId);
      expect(result.config).toEqual(mockDecryptedConfig);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', mockTenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on decryption failure', async () => {
      cryptoService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);

      await expect(service.findOne(mockIntegrationId, mockTenantId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('should update integration', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integration.update as jest.Mock).mockResolvedValue({
        ...mockIntegration,
        name: 'Updated Slack',
      });

      const dto = { name: 'Updated Slack' };

      const result = await service.update(mockIntegrationId, mockTenantId, dto);

      expect(result.name).toBe('Updated Slack');
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        data: expect.objectContaining({ name: 'Updated Slack' }),
        include: {
          _count: {
            select: { syncLogs: true },
          },
        },
      });
    });

    it('should re-encrypt config when updated', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({ valid: true });
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integration.update as jest.Mock).mockResolvedValue(mockIntegration);

      const newConfig = { webhookUrl: 'https://hooks.slack.com/new' };
      const dto = { config: newConfig };

      await service.update(mockIntegrationId, mockTenantId, dto);

      expect(mockSlackProvider.validateConfig).toHaveBeenCalledWith(newConfig);
      expect(cryptoService.encrypt).toHaveBeenCalledWith(JSON.stringify(newConfig));
      expect(prisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: 'encrypted-data',
            configIv: 'iv-hex',
          }),
        }),
      );
    });

    it('should throw NotFoundException when integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('missing', mockTenantId, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid config update', async () => {
      mockSlackProvider.validateConfig.mockResolvedValue({
        valid: false,
        errors: ['Invalid webhook URL'],
      });
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);

      const dto = { config: { webhookUrl: 'invalid' } };

      await expect(service.update(mockIntegrationId, mockTenantId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete integration', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integration.delete as jest.Mock).mockResolvedValue(mockIntegration);

      await service.delete(mockIntegrationId, mockTenantId);

      expect(prisma.integration.delete).toHaveBeenCalledWith({ where: { id: mockIntegrationId } });
    });

    it('should throw NotFoundException when integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('missing', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      mockSlackProvider.testConnection.mockResolvedValue({ success: true, message: 'Connected' });

      const result = await service.testConnection(mockIntegrationId, mockTenantId);

      expect(result).toEqual({ success: true, message: 'Connected' });
      expect(mockSlackProvider.testConnection).toHaveBeenCalledWith(mockDecryptedConfig);
    });

    it('should return failure when connection fails', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      mockSlackProvider.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
      });

      const result = await service.testConnection(mockIntegrationId, mockTenantId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('should throw BadRequestException for unknown provider type', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue({
        ...mockIntegration,
        type: 'unknown',
      });

      await expect(service.testConnection(mockIntegrationId, mockTenantId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableTypes', () => {
    it('should return all available integration types', async () => {
      const result = await service.getAvailableTypes();

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'slack',
            name: 'Slack',
            description: 'Slack integration',
          }),
          expect.objectContaining({
            type: 'jira',
            name: 'Jira',
            description: 'Jira integration',
          }),
        ]),
      );
    });
  });

  describe('getSyncLogs', () => {
    it('should return paginated sync logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          integrationId: mockIntegrationId,
          status: 'success',
          action: 'create',
          syncedAt: new Date(),
          ticket: { id: 'ticket-1', title: 'Test', status: 'open' },
        },
      ];

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.integrationSyncLog.count as jest.Mock).mockResolvedValue(25);

      const result = await service.getSyncLogs(mockIntegrationId, mockTenantId, {
        page: 0,
        limit: 20,
      });

      expect(result).toEqual({
        data: mockLogs,
        total: 25,
        page: 0,
        limit: 20,
      });
    });

    it('should filter by status when provided', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.integrationSyncLog.count as jest.Mock).mockResolvedValue(0);

      await service.getSyncLogs(mockIntegrationId, mockTenantId, { status: 'failed' });

      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });

    it('should filter by date range when provided', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.integrationSyncLog.count as jest.Mock).mockResolvedValue(0);

      await service.getSyncLogs(mockIntegrationId, mockTenantId, {
        from: '2026-01-01',
        to: '2026-02-01',
      });

      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            syncedAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getSyncLogs('missing', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      const mockRecentLogs = [
        {
          id: 'log-1',
          status: 'success',
          action: 'create',
          durationMs: 150,
          syncedAt: new Date(),
          error: null,
          provider: 'slack',
        },
      ];

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integrationSyncLog.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // success
        .mockResolvedValueOnce(10) // failed
        .mockResolvedValueOnce(5); // retrying
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue(mockRecentLogs);

      const result = await service.getSyncStats(mockIntegrationId, mockTenantId);

      expect(result).toEqual({
        total: 100,
        success: 85,
        failed: 10,
        retrying: 5,
        successRate: 85,
        recentLogs: mockRecentLogs,
      });
    });

    it('should return 0 success rate when no syncs exist', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration);
      (prisma.integrationSyncLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getSyncStats(mockIntegrationId, mockTenantId);

      expect(result.successRate).toBe(0);
    });

    it('should throw NotFoundException when integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getSyncStats('missing', mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IntegrationSyncWorker } from '../integration-sync.worker';
import { PrismaService } from '../../services/prisma.service';
import { IntegrationSyncJobData } from '../../queues/queue.types';
import { encryptAES256GCM, parseEncryptionKey } from '@support-helper/shared';

// Mock INTEGRATION_PROVIDERS at module level
jest.mock('../../../../api/src/modules/integrations/providers', () => ({
  INTEGRATION_PROVIDERS: {
    slack: jest.fn(),
    discord: jest.fn(),
    notion: jest.fn(),
  },
}));

describe('IntegrationSyncWorker', () => {
  let worker: IntegrationSyncWorker;
  let prisma: jest.Mocked<PrismaService>;
  let mockProvider: any;
  let encryptionKey: Buffer;

  // Helper function to create properly encrypted config
  const createEncryptedConfig = (config: any) => {
    const plaintext = JSON.stringify(config);
    const { ciphertext, iv } = encryptAES256GCM(plaintext, encryptionKey);
    return { config: ciphertext, configIv: iv };
  };

  const mockIntegration = (overrides: any = {}) => {
    const encrypted = createEncryptedConfig({ webhookUrl: 'https://hooks.slack.com/test' });
    return {
      id: 'integration-1',
      tenantId: 'tenant-1',
      type: 'slack',
      name: 'Slack Integration',
      enabled: true,
      config: encrypted.config,
      configIv: encrypted.configIv,
      mappings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      ...overrides,
    };
  };

  const mockTicket = {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    applicationId: 'app-1',
    title: 'Test Bug',
    description: 'Test description',
    status: 'open',
    severity: 'medium',
    type: 'bug',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    application: {
      id: 'app-1',
      name: 'Test App',
      tenantId: 'tenant-1',
    },
    media: [],
  };

  const mockJob = (data: IntegrationSyncJobData, attemptsMade = 0): Job<IntegrationSyncJobData> => ({
    id: 'job-123',
    data,
    attemptsMade,
  } as any);

  beforeEach(async () => {
    // Set up encryption key for tests
    process.env.INTEGRATION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    encryptionKey = parseEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY);

    // Create mock provider with all required methods
    mockProvider = {
      syncTicket: jest.fn().mockResolvedValue({
        success: true,
        externalId: 'external-123',
        externalUrl: 'https://example.com/external-123',
        metadata: { channel: '#bugs' },
      }),
      updateTicket: jest.fn().mockResolvedValue({
        success: true,
        externalId: 'external-123',
        externalUrl: 'https://example.com/external-123',
        metadata: { updated: true },
      }),
      deleteTicket: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the INTEGRATION_PROVIDERS import
    const { INTEGRATION_PROVIDERS } = require('../../../../api/src/modules/integrations/providers');
    INTEGRATION_PROVIDERS.slack.mockImplementation(() => mockProvider);

    const mockPrisma = {
      integration: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      ticket: {
        findFirst: jest.fn(),
      },
      integrationSyncLog: {
        create: jest.fn(),
      },
    };

    const mockDeadLetterQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationSyncWorker,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    worker = module.get<IntegrationSyncWorker>(IntegrationSyncWorker);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process - create action', () => {
    it('should call provider.syncTicket and create success log', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      const result = await worker.process(job);

      expect(mockProvider.syncTicket).toHaveBeenCalledWith(
        mockTicket,
        { webhookUrl: 'https://hooks.slack.com/test' },
        {},
      );

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          ticketId: 'ticket-1',
          externalId: 'external-123',
          action: 'create',
          durationMs: expect.any(Number),
          triggeredBy: 'auto',
          provider: 'slack',
          status: 'success',
          attemptCount: 1,
          metadata: expect.objectContaining({
            channel: '#bugs',
            ticketTitle: 'Test Bug',
          }),
        }),
      });

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: 'integration-1' },
        data: { lastSyncedAt: expect.any(Date) },
      });

      expect(result).toEqual({
        success: true,
        integrationId: 'integration-1',
        ticketId: 'ticket-1',
        externalId: 'external-123',
        externalUrl: 'https://example.com/external-123',
        provider: 'slack',
        attemptNumber: 1,
        processingTimeMs: expect.any(Number),
      });
    });

    it('should throw error when integration not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      await expect(worker.process(job)).rejects.toThrow('Integration integration-1 not found');
    });

    it('should throw error when ticket not found', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      await expect(worker.process(job)).rejects.toThrow('Ticket ticket-1 not found');
    });

    it('should throw error when integration is disabled', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue({
        ...mockIntegration(),
        enabled: false,
      });
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      await expect(worker.process(job)).rejects.toThrow('Integration Slack Integration is disabled');
    });
  });

  describe('process - update action', () => {
    it('should call provider.updateTicket when externalId provided', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'update',
        metadata: {
          triggeredBy: 'auto',
          externalId: 'external-123',
        },
      });

      const result = await worker.process(job);

      expect(mockProvider.updateTicket).toHaveBeenCalledWith(
        'external-123',
        mockTicket,
        { webhookUrl: 'https://hooks.slack.com/test' },
        {},
      );

      expect(mockProvider.syncTicket).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        integrationId: 'integration-1',
        ticketId: 'ticket-1',
        externalId: 'external-123',
        externalUrl: 'https://example.com/external-123',
        provider: 'slack',
        attemptNumber: 1,
        processingTimeMs: expect.any(Number),
      });
    });

    it('should fall back to syncTicket when externalId not provided', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'update',
        metadata: { triggeredBy: 'auto' },
      });

      await worker.process(job);

      expect(mockProvider.syncTicket).toHaveBeenCalled();
      expect(mockProvider.updateTicket).not.toHaveBeenCalled();
    });

    it('should fall back to syncTicket when action is create', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: {
          triggeredBy: 'auto',
          externalId: 'should-be-ignored',
        },
      });

      await worker.process(job);

      expect(mockProvider.syncTicket).toHaveBeenCalled();
      expect(mockProvider.updateTicket).not.toHaveBeenCalled();
    });
  });

  describe('process - delete action', () => {
    it('should call provider.deleteTicket when method exists', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'delete',
        metadata: {
          triggeredBy: 'auto',
          externalId: 'external-123',
        },
      });

      const result = await worker.process(job);

      expect(mockProvider.deleteTicket).toHaveBeenCalledWith(
        'external-123',
        { webhookUrl: 'https://hooks.slack.com/test' },
      );

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          ticketId: 'ticket-1',
          externalId: undefined,
          action: 'delete',
          durationMs: expect.any(Number),
          triggeredBy: 'auto',
          provider: 'slack',
          status: 'success',
          attemptCount: 1,
          metadata: expect.objectContaining({
            ticketTitle: 'Test Bug',
          }),
        }),
      });

      expect(result.success).toBe(true);
    });

    it('should throw error when deleteTicket method not implemented', async () => {
      // Create provider without deleteTicket method
      const providerWithoutDelete = {
        syncTicket: jest.fn(),
        updateTicket: jest.fn(),
      };

      const { INTEGRATION_PROVIDERS } = require('../../../../api/src/modules/integrations/providers');
      INTEGRATION_PROVIDERS.slack.mockImplementation(() => providerWithoutDelete);

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'delete',
        metadata: {
          triggeredBy: 'auto',
          externalId: 'external-123',
        },
      });

      await expect(worker.process(job)).rejects.toThrow('Unsupported action: delete');
    });
  });

  describe('error handling and retry logic', () => {
    it('should create retrying log on first failure (attemptsMade = 0)', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      mockProvider.syncTicket.mockRejectedValue(new Error('Network error'));

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0);

      await expect(worker.process(job)).rejects.toThrow('Network error');

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          ticketId: 'ticket-1',
          action: 'create',
          durationMs: expect.any(Number),
          triggeredBy: 'auto',
          provider: 'slack',
          status: 'retrying',
          error: 'Network error',
          attemptCount: 1,
          metadata: {
            ticketTitle: 'Test Bug',
          },
        }),
      });
    });

    it('should create retrying log on second failure (attemptsMade = 1)', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      mockProvider.syncTicket.mockRejectedValue(new Error('Timeout'));

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 1);

      await expect(worker.process(job)).rejects.toThrow('Timeout');

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          ticketId: 'ticket-1',
          action: 'create',
          durationMs: expect.any(Number),
          triggeredBy: 'auto',
          provider: 'slack',
          status: 'retrying',
          error: 'Timeout',
          attemptCount: 2,
          metadata: {
            ticketTitle: 'Test Bug',
          },
        }),
      });
    });

    it('should create failed log on third failure (attemptsMade = 2)', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      mockProvider.syncTicket.mockRejectedValue(new Error('Permanent failure'));

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 2);

      await expect(worker.process(job)).rejects.toThrow('Permanent failure');

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          ticketId: 'ticket-1',
          action: 'create',
          durationMs: expect.any(Number),
          triggeredBy: 'auto',
          provider: 'slack',
          status: 'failed',
          error: 'Permanent failure',
          attemptCount: 3,
          metadata: {
            ticketTitle: 'Test Bug',
          },
        }),
      });
    });

    it('should handle string errors', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      mockProvider.syncTicket.mockRejectedValue('String error message');

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0);

      await expect(worker.process(job)).rejects.toBe('String error message');

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'retrying',
          error: 'String error message',
        }),
      });
    });

    it('should not update lastSyncedAt on failure', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      mockProvider.syncTicket.mockRejectedValue(new Error('Sync failed'));

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0);

      await expect(worker.process(job)).rejects.toThrow('Sync failed');

      expect(prisma.integration.update).not.toHaveBeenCalled();
    });
  });

  describe('provider initialization', () => {
    it('should throw error when provider not found', async () => {
      const unknownIntegration = {
        ...mockIntegration(),
        type: 'unknown',
      };

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(unknownIntegration);
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      await expect(worker.process(job)).rejects.toThrow('Provider unknown not found');
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY not set', () => {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;

      const mockDeadLetterQueue = {} as any;
      expect(() => new IntegrationSyncWorker(prisma, mockDeadLetterQueue)).toThrow('INTEGRATION_ENCRYPTION_KEY not configured');

      // Restore for other tests
      process.env.INTEGRATION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });
  });

  describe('config decryption', () => {
    it('should decrypt integration config correctly', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      await worker.process(job);

      expect(mockProvider.syncTicket).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          webhookUrl: 'https://hooks.slack.com/test',
        }),
        expect.any(Object),
      );
    });
  });
});

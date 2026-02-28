import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IntegrationSyncWorker } from '../integration-sync.worker';
import { PrismaService } from '../../services/prisma.service';
import { IntegrationSyncJobData } from '../../queues/queue.types';
import { QUEUE_NAMES } from '../../queues';
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

  const mockJob = (
    data: IntegrationSyncJobData,
    attemptsMade = 0,
    opts: { attempts?: number } = { attempts: 4 },
  ): Job<IntegrationSyncJobData> => ({
    id: 'job-123',
    data,
    attemptsMade,
    opts,
  } as unknown as Job<IntegrationSyncJobData>);

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
        create: jest.fn(),
      },
      integrationSyncLog: {
        create: jest.fn(),
        findMany: jest.fn(),
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

      const mockDeadLetterQueue = {} as unknown as import('bullmq').Queue;
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

    it('should throw when config was encrypted with a different key (AC5 - invalid key)', async () => {
      // Encrypt with key A
      const keyA = parseEncryptionKey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbb');
      const { ciphertext, iv } = encryptAES256GCM(JSON.stringify({ token: 'secret' }), keyA);

      // Worker is initialised with keyB (0123...), so decryption will fail
      const integrationWithWrongKey = {
        ...mockIntegration(),
        config: ciphertext,
        configIv: iv,
      };

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(integrationWithWrongKey);
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0);

      await expect(worker.process(job)).rejects.toThrow();
      // Provider should never be called when config cannot be decrypted
      expect(mockProvider.syncTicket).not.toHaveBeenCalled();
    });

    it('should throw when configIv is corrupted (tampered ciphertext)', async () => {
      const integrationWithCorruptedIv = {
        ...mockIntegration(),
        configIv: 'deadbeefdeadbeef', // invalid iv
      };

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(integrationWithCorruptedIv);
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0);

      await expect(worker.process(job)).rejects.toThrow();
      expect(mockProvider.syncTicket).not.toHaveBeenCalled();
    });
  });

  describe('pull-tickets job', () => {
    it('should import new tickets from provider and create sync logs with status success', async () => {
      const pulledTickets = [
        {
          externalId: 'ext-001',
          externalUrl: 'https://jira.example.com/browse/BUG-1',
          title: 'Login crash',
          description: 'Crash on submit',
          status: 'open',
          severity: 'high',
          type: 'bug',
        },
      ];

      const mockPullProvider = {
        pullTickets: jest.fn().mockResolvedValue({
          success: true,
          tickets: pulledTickets,
        }),
      };

      const { INTEGRATION_PROVIDERS } = require('../../../../api/src/modules/integrations/providers');
      INTEGRATION_PROVIDERS.slack.mockImplementation(() => mockPullProvider);

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.create as jest.Mock).mockResolvedValue({ id: 'new-ticket-1' });
      (prisma.integrationSyncLog.create as jest.Mock).mockResolvedValue({});
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = {
        id: 'job-pull-1',
        name: 'pull-tickets',
        data: {
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          applicationId: 'app-1',
          metadata: { triggeredBy: 'manual' as const },
        },
        attemptsMade: 0,
      } as unknown as any;

      const result = await worker.process(job);

      expect(result).toMatchObject({
        success: true,
        integrationId: 'integration-1',
        imported: 1,
        skipped: 0,
        failed: 0,
        total: 1,
      });

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Login crash',
          tenantId: 'tenant-1',
          applicationId: 'app-1',
        }),
      });

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalId: 'ext-001',
          action: 'pull',
          status: 'success',
          provider: 'slack',
        }),
      });
    });

    it('should skip already-imported tickets (deduplicate by externalId)', async () => {
      const { INTEGRATION_PROVIDERS } = require('../../../../api/src/modules/integrations/providers');
      const mockPullProvider = {
        pullTickets: jest.fn().mockResolvedValue({
          success: true,
          tickets: [
            { externalId: 'ext-already-imported', title: 'Old ticket', description: '' },
          ],
        }),
      };
      INTEGRATION_PROVIDERS.slack.mockImplementation(() => mockPullProvider);

      (prisma.integration.findFirst as jest.Mock).mockResolvedValue(mockIntegration());
      // Pretend ext-already-imported was imported previously
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([
        { externalId: 'ext-already-imported' },
      ]);
      (prisma.integration.update as jest.Mock).mockResolvedValue({});

      const job = {
        id: 'job-pull-2',
        name: 'pull-tickets',
        data: {
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          applicationId: 'app-1',
        },
        attemptsMade: 0,
      } as unknown as any;

      const result = await worker.process(job);

      expect(result).toMatchObject({
        success: true,
        imported: 0,
        skipped: 1,
        failed: 0,
        total: 1,
      });

      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it('should skip pull and throw when integration is disabled', async () => {
      (prisma.integration.findFirst as jest.Mock).mockResolvedValue({
        ...mockIntegration(),
        enabled: false,
      });

      const job = {
        id: 'job-pull-3',
        name: 'pull-tickets',
        data: {
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          applicationId: 'app-1',
        },
        attemptsMade: 0,
      } as unknown as any;

      await expect(worker.process(job)).rejects.toThrow('Integration Slack Integration is disabled');
    });
  });

  describe('worker events', () => {
    it('onActive logs job start with attempt info', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log').mockImplementation(() => undefined);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 0, { attempts: 4 } as any);

      worker.onActive(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('job-123'),
      );
    });

    it('onCompleted logs success with timing', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log').mockImplementation(() => undefined);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      });

      const result = {
        success: true,
        integrationId: 'integration-1',
        ticketId: 'ticket-1',
        provider: 'slack',
        attemptNumber: 1,
        processingTimeMs: 250,
      };

      worker.onCompleted(job, result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('250ms'),
      );
    });

    it('onFailed with non-final attempt logs retry warning (no DLQ)', async () => {
      const warnSpy = jest.spyOn(worker['logger'], 'warn').mockImplementation(() => undefined);
      jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 1, { attempts: 4 } as any);

      // Access the deadLetterQueue via the module
      const deadLetterQueue = (worker as any).deadLetterQueue;

      await worker.onFailed(job, new Error('Network timeout'));

      expect(deadLetterQueue.add).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('retry'),
      );
    });

    it('onFailed at max attempts moves to dead letter queue', async () => {
      jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      const job = mockJob({
        ticketId: 'ticket-1',
        integrationId: 'integration-1',
        tenantId: 'tenant-1',
        action: 'create',
        metadata: { triggeredBy: 'auto' },
      }, 4, { attempts: 4 } as any);

      const deadLetterQueue = (worker as any).deadLetterQueue;
      const error = new Error('Max attempts exceeded');

      await worker.onFailed(job, error);

      expect(deadLetterQueue.add).toHaveBeenCalledWith(
        'failed-integration-sync',
        expect.objectContaining({
          originalJobId: 'job-123',
          queueName: QUEUE_NAMES.INTEGRATION_SYNC,
          jobData: job.data,
          failedReason: 'Max attempts exceeded',
          attemptsMade: 4,
          timestamp: expect.any(String),
        }),
        expect.objectContaining({
          removeOnComplete: { age: 90 * 24 * 60 * 60 },
        }),
      );
    });

    it('onFailed without job context logs error without crashing', async () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);

      await worker.onFailed(undefined, new Error('Missing job context'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing job context'),
      );
    });
  });
});

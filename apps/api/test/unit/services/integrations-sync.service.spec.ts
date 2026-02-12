import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IntegrationsSyncService } from '../../../src/modules/integrations/integrations-sync.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('IntegrationsSyncService', () => {
  let service: IntegrationsSyncService;
  let prisma: jest.Mocked<PrismaService>;
  let queue: jest.Mocked<Queue>;

  const mockIntegration = {
    id: 'integration-1',
    tenantId: 'tenant-1',
    type: 'slack',
    name: 'Slack Integration',
    enabled: true,
    config: 'encrypted-config',
    configIv: 'iv',
    mappings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: null,
  };

  const mockSyncLog = {
    id: 'log-1',
    ticketId: 'ticket-1',
    integrationId: 'integration-1',
    externalId: 'external-123',
    status: 'success' as const,
    syncedAt: new Date(),
    attemptCount: 1,
    error: null,
    metadata: {},
  };

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const mockPrisma = {
      integration: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      integrationSyncLog: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsSyncService,
        {
          provide: getQueueToken('integration-sync'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<IntegrationsSyncService>(IntegrationsSyncService);
    queue = module.get(getQueueToken('integration-sync'));
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncTicketToAllEnabledIntegrations', () => {
    describe('with action "create" (default)', () => {
      it('should find enabled integrations and queue create jobs', async () => {
        const integrations = [mockIntegration, { ...mockIntegration, id: 'integration-2' }];
        (prisma.integration.findMany as jest.Mock).mockResolvedValue(integrations);

        const result = await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1');

        expect(prisma.integration.findMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            enabled: true,
          },
        });

        expect(queue.add).toHaveBeenCalledTimes(2);
        expect(queue.add).toHaveBeenCalledWith(
          'sync-ticket',
          {
            ticketId: 'ticket-1',
            integrationId: 'integration-1',
            tenantId: 'tenant-1',
            action: 'create',
            metadata: {
              triggeredBy: 'auto',
            },
          },
          { priority: 2 },
        );

        expect(result).toEqual({ queued: 2 });
      });

      it('should return queued: 0 when no enabled integrations found', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([]);

        const result = await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1');

        expect(result).toEqual({ queued: 0 });
        expect(queue.add).not.toHaveBeenCalled();
      });

      it('should exclude integrations when excludeIntegrations provided', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          excludeIntegrations: ['integration-2', 'integration-3'],
        });

        expect(prisma.integration.findMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            enabled: true,
            id: { notIn: ['integration-2', 'integration-3'] },
          },
        });
      });

      it('should exclude integrations via SDK integrationOptions.exclude', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          integrationOptions: {
            exclude: ['integration-4'],
          },
        });

        expect(prisma.integration.findMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            enabled: true,
            id: { notIn: ['integration-4'] },
          },
        });
      });

      it('should merge excludeIntegrations and integrationOptions.exclude', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          excludeIntegrations: ['integration-2'],
          integrationOptions: {
            exclude: ['integration-3'],
          },
        });

        expect(prisma.integration.findMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            enabled: true,
            id: { notIn: ['integration-2', 'integration-3'] },
          },
        });
      });

      it('should respect custom priority', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          priority: 5,
        });

        expect(queue.add).toHaveBeenCalledWith(
          'sync-ticket',
          expect.any(Object),
          { priority: 5 },
        );
      });
    });

    describe('with action "update"', () => {
      it('should queue update job with externalId when sync log exists', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);
        (prisma.integrationSyncLog.findFirst as jest.Mock).mockResolvedValue(mockSyncLog);

        const result = await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          action: 'update',
        });

        expect(prisma.integrationSyncLog.findFirst).toHaveBeenCalledWith({
          where: {
            ticketId: 'ticket-1',
            integrationId: 'integration-1',
            status: 'success',
            externalId: { not: null },
          },
          orderBy: { syncedAt: 'desc' },
        });

        expect(queue.add).toHaveBeenCalledWith(
          'sync-ticket',
          {
            ticketId: 'ticket-1',
            integrationId: 'integration-1',
            tenantId: 'tenant-1',
            action: 'update',
            metadata: {
              triggeredBy: 'auto',
              externalId: 'external-123',
            },
          },
          { priority: 2 },
        );

        expect(result).toEqual({ queued: 1 });
      });

      it('should fall back to create when no sync log exists', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);
        (prisma.integrationSyncLog.findFirst as jest.Mock).mockResolvedValue(null);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          action: 'update',
        });

        expect(queue.add).toHaveBeenCalledWith(
          'sync-ticket',
          {
            ticketId: 'ticket-1',
            integrationId: 'integration-1',
            tenantId: 'tenant-1',
            action: 'create',
            metadata: {
              triggeredBy: 'auto',
            },
          },
          { priority: 2 },
        );
      });

      it('should fall back to create when externalId is null', async () => {
        (prisma.integration.findMany as jest.Mock).mockResolvedValue([mockIntegration]);
        (prisma.integrationSyncLog.findFirst as jest.Mock).mockResolvedValue({
          ...mockSyncLog,
          externalId: null,
        });

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          action: 'update',
        });

        expect(queue.add).toHaveBeenCalledWith(
          'sync-ticket',
          expect.objectContaining({
            action: 'create',
            metadata: {
              triggeredBy: 'auto',
            },
          }),
          expect.any(Object),
        );
      });

      it('should handle multiple integrations with mixed sync log states', async () => {
        const integrations = [
          mockIntegration,
          { ...mockIntegration, id: 'integration-2' },
        ];
        (prisma.integration.findMany as jest.Mock).mockResolvedValue(integrations);
        (prisma.integrationSyncLog.findFirst as jest.Mock)
          .mockResolvedValueOnce(mockSyncLog)
          .mockResolvedValueOnce(null);

        await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          action: 'update',
        });

        expect(queue.add).toHaveBeenCalledTimes(2);
        expect(queue.add).toHaveBeenNthCalledWith(
          1,
          'sync-ticket',
          expect.objectContaining({
            action: 'update',
            metadata: {
              triggeredBy: 'auto',
              externalId: 'external-123',
            },
          }),
          expect.any(Object),
        );
        expect(queue.add).toHaveBeenNthCalledWith(
          2,
          'sync-ticket',
          expect.objectContaining({
            action: 'create',
            metadata: {
              triggeredBy: 'auto',
            },
          }),
          expect.any(Object),
        );
      });
    });

    describe('with integrationOptions.enabled', () => {
      it('should skip sync when integrationOptions.enabled is false', async () => {
        const result = await service.syncTicketToAllEnabledIntegrations('ticket-1', 'tenant-1', {
          integrationOptions: {
            enabled: false,
          },
        });

        expect(result).toEqual({ queued: 0, reason: 'disabled_by_sdk' });
        expect(prisma.integration.findMany).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteTicketFromAllIntegrations', () => {
    const mockSyncLogWithIntegration = {
      ...mockSyncLog,
      integration: mockIntegration,
    };

    it('should queue delete jobs for all successful sync logs with externalId', async () => {
      const syncLogs = [
        mockSyncLogWithIntegration,
        {
          ...mockSyncLogWithIntegration,
          id: 'log-2',
          integrationId: 'integration-2',
          externalId: 'external-456',
        },
      ];
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue(syncLogs);

      const result = await service.deleteTicketFromAllIntegrations('ticket-1', 'tenant-1');

      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith({
        where: {
          ticketId: 'ticket-1',
          status: 'success',
          externalId: { not: null },
          integration: {
            tenantId: 'tenant-1',
            enabled: true,
          },
        },
        include: {
          integration: true,
        },
        orderBy: { syncedAt: 'desc' },
      });

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenNthCalledWith(
        1,
        'sync-ticket',
        {
          ticketId: 'ticket-1',
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          action: 'delete',
          metadata: {
            triggeredBy: 'auto',
            externalId: 'external-123',
          },
        },
        { priority: 3 },
      );

      expect(result).toEqual({ queued: 2 });
    });

    it('should return queued: 0 when no sync logs exist', async () => {
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.deleteTicketFromAllIntegrations('ticket-1', 'tenant-1');

      expect(result).toEqual({ queued: 0 });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should only include sync logs from enabled integrations', async () => {
      (prisma.integrationSyncLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.deleteTicketFromAllIntegrations('ticket-1', 'tenant-1');

      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integration: {
              tenantId: 'tenant-1',
              enabled: true,
            },
          }),
        }),
      );
    });
  });

  describe('syncTicketToIntegration', () => {
    it('should queue a manual sync job with default action "create"', async () => {
      const result = await service.syncTicketToIntegration(
        'ticket-1',
        'integration-1',
        'tenant-1',
      );

      expect(queue.add).toHaveBeenCalledWith(
        'sync-ticket',
        {
          ticketId: 'ticket-1',
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          action: 'create',
          metadata: {
            triggeredBy: 'manual',
            externalId: undefined,
          },
        },
        { priority: 3 },
      );

      expect(result).toEqual({ queued: 1 });
    });

    it('should queue an update job with externalId', async () => {
      await service.syncTicketToIntegration('ticket-1', 'integration-1', 'tenant-1', {
        action: 'update',
        externalId: 'external-999',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'sync-ticket',
        {
          ticketId: 'ticket-1',
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          action: 'update',
          metadata: {
            triggeredBy: 'manual',
            externalId: 'external-999',
          },
        },
        { priority: 3 },
      );
    });

    it('should queue a delete job', async () => {
      await service.syncTicketToIntegration('ticket-1', 'integration-1', 'tenant-1', {
        action: 'delete',
        externalId: 'external-999',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'sync-ticket',
        expect.objectContaining({
          action: 'delete',
        }),
        expect.any(Object),
      );
    });

    it('should respect custom priority', async () => {
      await service.syncTicketToIntegration('ticket-1', 'integration-1', 'tenant-1', {
        priority: 1,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'sync-ticket',
        expect.any(Object),
        { priority: 1 },
      );
    });
  });

  describe('updateTicketOnIntegration', () => {
    it('should queue an update job with externalId', async () => {
      await service.updateTicketOnIntegration(
        'ticket-1',
        'integration-1',
        'tenant-1',
        'external-777',
      );

      expect(queue.add).toHaveBeenCalledWith(
        'sync-ticket',
        {
          ticketId: 'ticket-1',
          integrationId: 'integration-1',
          tenantId: 'tenant-1',
          action: 'update',
          metadata: {
            triggeredBy: 'auto',
            externalId: 'external-777',
          },
        },
        { priority: 3 },
      );
    });
  });
});

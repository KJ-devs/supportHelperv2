import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IntegrationsSyncService {
  private readonly logger = new Logger(IntegrationsSyncService.name);

  constructor(
    @InjectQueue('integration-sync') private integrationSyncQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async syncTicketToAllEnabledIntegrations(
    ticketId: string,
    tenantId: string,
    options?: {
      priority?: number;
      excludeIntegrations?: string[];
      integrationOptions?: { enabled?: boolean; exclude?: string[] };
      action?: 'create' | 'update';
    },
  ) {
    if (options?.integrationOptions?.enabled === false) {
      this.logger.log(`Integration sync disabled for ticket ${ticketId} via SDK options`);
      return { queued: 0, reason: 'disabled_by_sdk' };
    }

    const excludeIntegrations = [
      ...(options?.excludeIntegrations || []),
      ...(options?.integrationOptions?.exclude || []),
    ];

    const integrations = await this.prisma.integration.findMany({
      where: {
        tenantId,
        enabled: true,
        ...(excludeIntegrations.length > 0 && {
          id: { notIn: excludeIntegrations },
        }),
      },
    });

    if (integrations.length === 0) {
      this.logger.log(`No enabled integrations found for tenant ${tenantId}`);
      return { queued: 0 };
    }

    const action = options?.action || 'create';

    const jobs = integrations.map(async (integration) => {
      let syncAction: 'create' | 'update' = action;
      let externalId: string | undefined;

      // If updating, check for existing sync log with externalId
      if (action === 'update') {
        const existingLog = await this.prisma.integrationSyncLog.findFirst({
          where: {
            ticketId,
            integrationId: integration.id,
            status: 'success',
            externalId: { not: null },
          },
          orderBy: { syncedAt: 'desc' },
        });

        if (existingLog?.externalId) {
          externalId = existingLog.externalId;
          this.logger.log(`Found existing externalId ${externalId} for ticket ${ticketId} on integration ${integration.id}`);
        } else {
          // No existing sync, fall back to create
          syncAction = 'create';
          this.logger.log(`No existing sync found for ticket ${ticketId} on integration ${integration.id}, falling back to create`);
        }
      }

      return this.integrationSyncQueue.add(
        'sync-ticket',
        {
          ticketId,
          integrationId: integration.id,
          tenantId,
          action: syncAction,
          metadata: {
            triggeredBy: 'auto' as const,
            ...(externalId && { externalId }),
          },
        },
        {
          priority: options?.priority || 2,
        },
      );
    });

    await Promise.all(jobs);

    this.logger.log(`Queued ${integrations.length} integration sync jobs for ticket ${ticketId} (action: ${action})`);

    return { queued: integrations.length };
  }

  async deleteTicketFromAllIntegrations(ticketId: string, tenantId: string) {
    // Find all successful sync logs with externalId
    const syncLogs = await this.prisma.integrationSyncLog.findMany({
      where: {
        ticketId,
        status: 'success',
        externalId: { not: null },
        integration: {
          tenantId,
          enabled: true,
        },
      },
      include: {
        integration: true,
      },
      orderBy: { syncedAt: 'desc' },
    });

    if (syncLogs.length === 0) {
      this.logger.log(`No synced integrations found for ticket ${ticketId}`);
      return { queued: 0 };
    }

    // Queue delete jobs for each integration
    const jobs = syncLogs.map((log) =>
      this.integrationSyncQueue.add(
        'sync-ticket',
        {
          ticketId,
          integrationId: log.integrationId,
          tenantId,
          action: 'delete' as const,
          metadata: {
            triggeredBy: 'auto' as const,
            externalId: log.externalId,
          },
        },
        {
          priority: 3,
        },
      ),
    );

    await Promise.all(jobs);

    this.logger.log(`Queued ${syncLogs.length} integration delete jobs for ticket ${ticketId}`);

    return { queued: syncLogs.length };
  }

  async syncTicketToIntegration(
    ticketId: string,
    integrationId: string,
    tenantId: string,
    options?: {
      priority?: number;
      action?: 'create' | 'update' | 'delete';
      externalId?: string;
    },
  ) {
    await this.integrationSyncQueue.add(
      'sync-ticket',
      {
        ticketId,
        integrationId,
        tenantId,
        action: (options?.action || 'create') as 'create' | 'update' | 'delete',
        metadata: {
          triggeredBy: 'manual' as const,
          externalId: options?.externalId,
        },
      },
      {
        priority: options?.priority || 3,
      },
    );

    this.logger.log(`Queued integration sync job for ticket ${ticketId} to integration ${integrationId}`);

    return { queued: 1 };
  }

  async updateTicketOnIntegration(
    ticketId: string,
    integrationId: string,
    tenantId: string,
    externalId: string,
  ) {
    await this.integrationSyncQueue.add(
      'sync-ticket',
      {
        ticketId,
        integrationId,
        tenantId,
        action: 'update' as const,
        metadata: {
          triggeredBy: 'auto' as const,
          externalId,
        },
      },
      {
        priority: 3,
      },
    );

    this.logger.log(`Queued integration update job for ticket ${ticketId}`);
  }
}

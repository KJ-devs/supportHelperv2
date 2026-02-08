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

    const jobs = integrations.map((integration) =>
      this.integrationSyncQueue.add(
        'sync-ticket',
        {
          ticketId,
          integrationId: integration.id,
          tenantId,
          action: 'create' as const,
          metadata: { triggeredBy: 'auto' as const },
        },
        {
          priority: options?.priority || 2,
        },
      ),
    );

    await Promise.all(jobs);

    this.logger.log(`Queued ${integrations.length} integration sync jobs for ticket ${ticketId}`);

    return { queued: integrations.length };
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

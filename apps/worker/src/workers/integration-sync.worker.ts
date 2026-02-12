import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IntegrationSyncJobData, IntegrationSyncResult, IntegrationPullJobData, IntegrationPullResult } from '../queues/queue.types';
import { PrismaService } from '../services/prisma.service';
import { decryptAES256GCM, parseEncryptionKey } from '@support-helper/shared';
import { INTEGRATION_PROVIDERS } from '../../../api/src/modules/integrations/providers';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

@Processor('integration-sync', {
  concurrency: 10,
  limiter: {
    max: 250, // Increased from 100 to handle large bulk syncs (e.g., 173+ tickets)
    duration: 60000,
  },
})
export class IntegrationSyncWorker extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncWorker.name);
  private readonly key: Buffer;

  constructor(private readonly prisma: PrismaService) {
    super();

    const keyString = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');
    }

    this.key = parseEncryptionKey(keyString);
  }

  async process(job: Job<IntegrationSyncJobData | IntegrationPullJobData>): Promise<IntegrationSyncResult | IntegrationPullResult> {
    if (job.name === 'pull-tickets') {
      return this.processPullTickets(job as Job<IntegrationPullJobData>);
    }

    const data = job.data as IntegrationSyncJobData;
    const startTime = Date.now();
    const { ticketId, integrationId, tenantId, action, metadata } = data;

    this.logger.log(`Processing integration sync job ${job.id} for ticket ${ticketId}`);

    try {
      const [integration, ticket] = await Promise.all([
        this.prisma.integration.findFirst({
          where: { id: integrationId, tenantId },
        }),
        this.prisma.ticket.findFirst({
          where: { id: ticketId, tenantId },
          include: { application: true, media: true },
        }),
      ]);

      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      if (!integration.enabled) {
        throw new Error(`Integration ${integration.name} is disabled`);
      }

      const config = JSON.parse(decryptAES256GCM(integration.config, integration.configIv, this.key));

      const Provider = INTEGRATION_PROVIDERS[integration.type as keyof typeof INTEGRATION_PROVIDERS];
      if (!Provider) {
        throw new Error(`Provider ${integration.type} not found`);
      }

      const provider = new Provider();

      let result;

      try {
        if (action === 'create' || !metadata?.externalId) {
          result = await provider.syncTicket(ticket, config, integration.mappings as any);
        } else if (action === 'update') {
          result = await provider.updateTicket(metadata.externalId, ticket, config, integration.mappings as any);
        } else if (action === 'delete' && 'deleteTicket' in provider) {
          await (provider as any).deleteTicket(metadata.externalId, config);
          result = { success: true };
        } else {
          throw new Error(`Unsupported action: ${action}`);
        }

        await this.prisma.integrationSyncLog.create({
          data: {
            integrationId,
            ticketId,
            externalId: result.externalId,
            action,
            durationMs: Date.now() - startTime,
            externalUrl: result.externalUrl,
            triggeredBy: metadata?.triggeredBy || 'auto',
            provider: integration.type,
            status: 'success',
            attemptCount: job.attemptsMade + 1,
            metadata: {
              ...(result.metadata || {}),
              ticketTitle: ticket.title,
            },
          },
        });

        await this.prisma.integration.update({
          where: { id: integrationId },
          data: { lastSyncedAt: new Date() },
        });

        this.logger.log(`Successfully synced ticket ${ticketId} to ${integration.type}`);

        return {
          success: true,
          integrationId,
          ticketId,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          provider: integration.type,
          attemptNumber: job.attemptsMade + 1,
          processingTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        await this.prisma.integrationSyncLog.create({
          data: {
            integrationId,
            ticketId,
            action,
            durationMs: Date.now() - startTime,
            triggeredBy: metadata?.triggeredBy || 'auto',
            provider: integration.type,
            status: job.attemptsMade >= 2 ? 'failed' : 'retrying',
            error: getErrorMessage(error),
            attemptCount: job.attemptsMade + 1,
            metadata: {
              ticketTitle: ticket.title,
            },
          },
        });

        throw error;
      }
    } catch (error) {
      this.logger.error(`Integration sync failed: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  private async processPullTickets(job: Job<IntegrationPullJobData>): Promise<IntegrationPullResult> {
    const startTime = Date.now();
    const { integrationId, tenantId, applicationId, metadata } = job.data;

    this.logger.log(`Processing pull-tickets job ${job.id} for integration ${integrationId}`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const integration = await this.prisma.integration.findFirst({
        where: { id: integrationId, tenantId },
      });

      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      if (!integration.enabled) {
        throw new Error(`Integration ${integration.name} is disabled`);
      }

      const config = JSON.parse(decryptAES256GCM(integration.config, integration.configIv, this.key));

      const Provider = INTEGRATION_PROVIDERS[integration.type as keyof typeof INTEGRATION_PROVIDERS];
      if (!Provider) {
        throw new Error(`Provider ${integration.type} not found`);
      }

      const provider = new Provider();

      if (!('pullTickets' in provider) || typeof provider.pullTickets !== 'function') {
        throw new Error(`Provider ${integration.type} does not support pulling tickets`);
      }

      const pullResult = await provider.pullTickets(config);

      if (!pullResult.success) {
        throw new Error(pullResult.error || 'Pull failed');
      }

      // Check for existing imports to avoid duplicates
      const existingLogs = await this.prisma.integrationSyncLog.findMany({
        where: {
          integrationId,
          action: 'pull',
          status: 'success',
          externalId: { not: null },
        },
        select: { externalId: true },
      });

      const existingExternalIds = new Set(existingLogs.map((l) => l.externalId));

      for (const pulledTicket of pullResult.tickets) {
        if (existingExternalIds.has(pulledTicket.externalId)) {
          skipped++;
          continue;
        }

        try {
          const ticket = await this.prisma.ticket.create({
            data: {
              title: pulledTicket.title,
              description: pulledTicket.description || '',
              status: pulledTicket.status || 'open',
              severity: pulledTicket.severity || 'medium',
              type: pulledTicket.type || 'bug',
              tenantId,
              applicationId,
              metadata: {
                importedFrom: integration.type,
                externalId: pulledTicket.externalId,
                externalUrl: pulledTicket.externalUrl,
                ...(pulledTicket.metadata || {}),
              },
            },
          });

          await this.prisma.integrationSyncLog.create({
            data: {
              integrationId,
              ticketId: ticket.id,
              externalId: pulledTicket.externalId,
              externalUrl: pulledTicket.externalUrl,
              action: 'pull',
              status: 'success',
              durationMs: Date.now() - startTime,
              triggeredBy: metadata?.triggeredBy || 'manual',
              provider: integration.type,
              attemptCount: 1,
              metadata: {
                ticketTitle: pulledTicket.title,
                importedAt: new Date().toISOString(),
              },
            },
          });

          imported++;
        } catch (err) {
          this.logger.error(`Failed to import ticket ${pulledTicket.externalId}: ${getErrorMessage(err)}`);
          failed++;

          await this.prisma.integrationSyncLog.create({
            data: {
              integrationId,
              ticketId: 'import-failed',
              externalId: pulledTicket.externalId,
              action: 'pull',
              status: 'failed',
              error: getErrorMessage(err),
              durationMs: Date.now() - startTime,
              triggeredBy: metadata?.triggeredBy || 'manual',
              provider: integration.type,
              attemptCount: 1,
              metadata: {
                ticketTitle: pulledTicket.title,
              },
            },
          });
        }
      }

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncedAt: new Date() },
      });

      this.logger.log(
        `Pull complete for integration ${integrationId}: ${imported} imported, ${skipped} skipped, ${failed} failed`,
      );

      return {
        success: true,
        integrationId,
        imported,
        skipped,
        failed,
        total: pullResult.tickets.length,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Pull-tickets failed: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }
}

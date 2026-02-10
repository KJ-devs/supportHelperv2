import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IntegrationSyncJobData, IntegrationSyncResult } from '../queues/queue.types';
import { PrismaService } from '../services/prisma.service';
import { createDecipheriv } from 'crypto';
import { INTEGRATION_PROVIDERS } from '../../../api/src/modules/integrations/providers';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

@Processor('integration-sync', {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
})
export class IntegrationSyncWorker extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncWorker.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly prisma: PrismaService) {
    super();

    const keyString = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');
    }

    this.key = Buffer.from(keyString, 'hex');
    if (this.key.length !== 32) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
    }
  }

  async process(job: Job<IntegrationSyncJobData>): Promise<IntegrationSyncResult> {
    const startTime = Date.now();
    const { ticketId, integrationId, tenantId, action, metadata } = job.data;

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

      const config = JSON.parse(this.decrypt(integration.config, integration.configIv));

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
            status: 'success',
            attemptCount: job.attemptsMade + 1,
            metadata: result.metadata || {},
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
            status: job.attemptsMade >= 2 ? 'failed' : 'retrying',
            error: getErrorMessage(error),
            attemptCount: job.attemptsMade + 1,
          },
        });

        throw error;
      }
    } catch (error) {
      this.logger.error(`Integration sync failed: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  private decrypt(ciphertext: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(ciphertext.slice(-32), 'hex');
    const encrypted = ciphertext.slice(0, -32);

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }



}

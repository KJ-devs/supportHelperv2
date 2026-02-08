import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { IntegrationSyncJobData, IntegrationSyncResult } from '../queues/queue.types';
import { PrismaService } from '../services/prisma.service';
import { createDecipheriv } from 'crypto';
import { INTEGRATION_PROVIDERS } from '../../../api/src/modules/integrations/providers';

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

      const Provider = INTEGRATION_PROVIDERS[integration.type];
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
        } else if (action === 'delete' && provider.deleteTicket) {
          await provider.deleteTicket(metadata.externalId, config);
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
            error: error.message,
            attemptCount: job.attemptsMade + 1,
          },
        });

        throw error;
      }
    } catch (error) {
      this.logger.error(`Integration sync failed: ${error.message}`, error.stack);
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

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: IntegrationSyncResult) {
    this.logger.log(
      `Integration sync completed for job ${job.id}: ticket ${result.ticketId} → ${result.provider} (${result.processingTimeMs}ms)`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Integration sync failed for job ${job.id}: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Integration sync progress for job ${job.id}: ${progress}%`);
  }
}

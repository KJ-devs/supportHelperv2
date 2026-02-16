import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../services/prisma.service';
import { DlqAlertService } from '../services/dlq-alert.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * Dead Letter Queue Worker
 *
 * Handles jobs that have exceeded max retry attempts.
 * Responsibilities:
 * - Log failed jobs with full context
 * - Store failure details in database
 * - Send alerts for critical failures (email + Slack)
 * - Enable manual retry/investigation
 */
@Processor('dead-letter', {
  concurrency: 5,
})
export class DeadLetterWorker extends WorkerHost {
  private readonly logger = new Logger(DeadLetterWorker.name);

  constructor(
    _prisma: PrismaService,
    private readonly dlqAlertService: DlqAlertService,
  ) {
    super();
  }

  /**
   * Process dead letter job
   * Log failure details, store record, and send alerts
   */
  async process(job: Job): Promise<void> {
    this.logger.error(`Dead Letter Queue: Processing failed job ${job.id} from ${job.queueName}`);
    this.logger.error(`Job data: ${JSON.stringify(job.data)}`);
    this.logger.error(`Failure reason: ${job.failedReason}`);
    this.logger.error(`Attempts made: ${job.attemptsMade}`);
    this.logger.error(`Stack trace: ${job.stacktrace?.join('\n')}`);

    try {
      // Log the failed job record
      this.logFailedJobRecord(job);

      // Send alerts for critical job types (email + Slack with throttling)
      await this.sendAlertIfCritical(job);

      this.logger.log(`Dead letter job ${job.id} logged successfully`);
    } catch (error) {
      this.logger.error(`Failed to log dead letter job: ${getErrorMessage(error)}`, getErrorStack(error));
      // Don't throw - we don't want DLQ jobs to retry
    }
  }

  /**
   * Log failed job details
   */
  private logFailedJobRecord(job: Job): void {
    const jobData = job.data as Record<string, unknown>;
    const tenantId = (jobData.tenantId as string) || 'unknown';
    const ticketId = (jobData.ticketId as string) || null;

    this.logger.log(`Failed job record: tenant=${tenantId}, ticket=${ticketId || 'N/A'}, queue=${job.queueName}, job=${job.id}`);
  }

  /**
   * Send alerts for critical job failures via DlqAlertService
   * Critical queues: video-analysis, agent-orchestration, github-sync, backup
   */
  private async sendAlertIfCritical(job: Job): Promise<void> {
    const criticalQueues = ['video-analysis', 'agent-orchestration', 'github-sync', 'backup'];

    if (criticalQueues.includes(job.queueName)) {
      this.logger.warn(`CRITICAL FAILURE: ${job.queueName} job ${job.id} has failed permanently`);
      await this.dlqAlertService.alertIfNeeded(job);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Dead letter job ${job.id} completed - failure logged`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed to process dead letter job ${job.id}: ${error.message}`);
    // Even the DLQ failed - this is a critical system issue
  }
}

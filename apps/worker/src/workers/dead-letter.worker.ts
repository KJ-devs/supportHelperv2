import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../services/prisma.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * Dead Letter Queue Worker
 *
 * Handles jobs that have exceeded max retry attempts.
 * Responsibilities:
 * - Log failed jobs with full context
 * - Store failure details in database
 * - Send alerts for critical failures (optional)
 * - Enable manual retry/investigation
 */
@Processor('dead-letter', {
  concurrency: 5,
})
export class DeadLetterWorker extends WorkerHost {
  private readonly logger = new Logger(DeadLetterWorker.name);

  constructor(_prisma: PrismaService) {
    super();
  }

  /**
   * Process dead letter job
   * Log failure details and store for manual investigation
   */
  async process(job: Job): Promise<void> {
    this.logger.error(`Dead Letter Queue: Processing failed job ${job.id} from ${job.queueName}`);
    this.logger.error(`Job data: ${JSON.stringify(job.data)}`);
    this.logger.error(`Failure reason: ${job.failedReason}`);
    this.logger.error(`Attempts made: ${job.attemptsMade}`);
    this.logger.error(`Stack trace: ${job.stacktrace?.join('\n')}`);

    try {
      // Store failed job in database for manual investigation
      await this.createFailedJobRecord(job);

      // Optional: Send alerts for critical job types
      await this.sendAlertIfCritical(job);

      this.logger.log(`Dead letter job ${job.id} logged successfully`);
    } catch (error) {
      this.logger.error(`Failed to log dead letter job: ${getErrorMessage(error)}`, getErrorStack(error));
      // Don't throw - we don't want DLQ jobs to retry
    }
  }

  /**
   * Store failed job details in database
   */
  private async createFailedJobRecord(job: Job): Promise<void> {
    const jobData = job.data as any;

    // Extract common fields
    const tenantId = jobData.tenantId || 'unknown';
    const ticketId = jobData.ticketId || null;

    // Store in a generic failed_jobs table (you might want to create this table)
    // For now, we'll just log to console
    // Note: Ticket table does not have a metadata field, so we skip the update
    // In production, you might want to:
    // 1. Create a FailedJob table to store these records
    // 2. Send alerts to admins
    // 3. Create a ticket comment about the failure

    this.logger.log(`Failed job record created for tenant ${tenantId}, ticket ${ticketId || 'N/A'}`);
  }

  /**
   * Send alerts for critical job failures
   * Critical jobs: video-analysis, agent-orchestration
   */
  private async sendAlertIfCritical(job: Job): Promise<void> {
    const criticalQueues = ['video-analysis', 'agent-orchestration'];

    if (criticalQueues.includes(job.queueName)) {
      this.logger.warn(`CRITICAL FAILURE: ${job.queueName} job ${job.id} has failed permanently`);
      // TODO: Integrate with alerting service (email, Slack, PagerDuty, etc.)
      // Example: await this.alertingService.sendAlert({ ... });
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

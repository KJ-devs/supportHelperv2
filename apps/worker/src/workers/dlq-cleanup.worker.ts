import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DlqCleanupService } from '../services/dlq-cleanup.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

export interface DlqCleanupJobData {
  triggeredBy: 'cron' | 'manual';
}

export interface DlqCleanupResult {
  success: boolean;
  archived: number;
  deletedFromDlq: number;
  deletedFromArchive: number;
  dlqSize: number;
  archiveSize: number;
  error?: string;
  duration: number;
}

/**
 * DLQ Cleanup Worker
 *
 * Scheduled job that runs daily to:
 * 1. Archive old DLQ entries to database
 * 2. Remove archived entries from Redis
 * 3. Delete very old archived entries
 *
 * Default schedule: Daily at 2 AM UTC
 */
@Processor('dlq-cleanup', {
  concurrency: 1, // Only one cleanup job at a time
})
export class DlqCleanupWorker extends WorkerHost {
  private readonly logger = new Logger(DlqCleanupWorker.name);

  constructor(private readonly dlqCleanupService: DlqCleanupService) {
    super();
  }

  async process(job: Job<DlqCleanupJobData>): Promise<DlqCleanupResult> {
    const startTime = Date.now();
    const { triggeredBy } = job.data;

    this.logger.log(
      `Starting DLQ cleanup job ${job.id} (triggered by: ${triggeredBy})`,
    );

    try {
      const result = await this.dlqCleanupService.runCleanup();

      const duration = Date.now() - startTime;

      this.logger.log(
        `DLQ cleanup completed successfully: archived=${result.archived}, ` +
          `deletedFromDlq=${result.deletedFromDlq}, deletedFromArchive=${result.deletedFromArchive}, ` +
          `dlqSize=${result.dlqSize}, archiveSize=${result.archiveSize}, duration=${duration}ms`,
      );

      return {
        success: true,
        ...result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `DLQ cleanup failed: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );

      return {
        success: false,
        archived: 0,
        deletedFromDlq: 0,
        deletedFromArchive: 0,
        dlqSize: 0,
        archiveSize: 0,
        error: getErrorMessage(error),
        duration,
      };
    }
  }
}

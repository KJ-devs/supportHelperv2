import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from './prisma.service';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Dead Letter Queue Cleanup Service
 *
 * Responsibilities:
 * - Archive DLQ entries older than retention period (default: 30 days)
 * - Delete archived entries older than archive retention (default: 90 days)
 * - Provide metrics on DLQ size and cleanup operations
 */
@Injectable()
export class DlqCleanupService {
  private readonly logger = new Logger(DlqCleanupService.name);
  private readonly dlqRetentionDays: number;
  private readonly archiveRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('dead-letter') private readonly dlqQueue: Queue,
  ) {
    // Read retention periods from environment with defaults
    this.dlqRetentionDays = parseInt(
      this.configService.get<string>('DLQ_RETENTION_DAYS', '30'),
      10,
    );
    this.archiveRetentionDays = parseInt(
      this.configService.get<string>('DLQ_ARCHIVE_RETENTION_DAYS', '90'),
      10,
    );

    this.logger.log(
      `DLQ Cleanup Service initialized: DLQ retention=${this.dlqRetentionDays}d, Archive retention=${this.archiveRetentionDays}d`,
    );
  }

  /**
   * Run full cleanup workflow
   * 1. Archive old DLQ jobs to database
   * 2. Remove archived jobs from Redis DLQ
   * 3. Delete old archived jobs from database
   */
  async runCleanup(): Promise<{
    archived: number;
    deletedFromDlq: number;
    deletedFromArchive: number;
    dlqSize: number;
    archiveSize: number;
  }> {
    this.logger.log('Starting DLQ cleanup job...');
    const startTime = Date.now();

    try {
      // Step 1: Archive old DLQ jobs
      const archived = await this.archiveOldJobs();

      // Step 2: Remove archived jobs from Redis
      const deletedFromDlq = await this.removeArchivedJobsFromDlq();

      // Step 3: Delete old archived jobs
      const deletedFromArchive = await this.deleteOldArchivedJobs();

      // Step 4: Get current sizes
      const dlqSize = await this.getDlqSize();
      const archiveSize = await this.getArchiveSize();

      const duration = Date.now() - startTime;

      this.logger.log(
        `DLQ cleanup completed in ${duration}ms: archived=${archived}, deletedFromDlq=${deletedFromDlq}, deletedFromArchive=${deletedFromArchive}, dlqSize=${dlqSize}, archiveSize=${archiveSize}`,
      );

      return {
        archived,
        deletedFromDlq,
        deletedFromArchive,
        dlqSize,
        archiveSize,
      };
    } catch (error) {
      this.logger.error(`DLQ cleanup failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Archive DLQ jobs older than retention period to database
   */
  private async archiveOldJobs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.dlqRetentionDays);

    this.logger.log(
      `Archiving DLQ jobs older than ${cutoffDate.toISOString()}...`,
    );

    // Get failed jobs from DLQ
    const failedJobs = await this.dlqQueue.getFailed(0, -1);

    let archived = 0;
    for (const job of failedJobs) {
      // Check if job is older than cutoff
      if (job.processedOn && job.processedOn < cutoffDate.getTime()) {
        try {
          // Extract metadata from job data
          const jobData = job.data as any;
          const tenantId = jobData.tenantId || null;
          const ticketId = jobData.ticketId || null;
          const applicationId = jobData.applicationId || null;

          // Archive to database
          await this.prisma.archivedDeadLetterJob.create({
            data: {
              tenantId,
              queueName: job.queueName,
              jobId: job.id!,
              jobName: job.name,
              jobData: job.data,
              failedReason: job.failedReason || null,
              stackTrace: job.stacktrace || [],
              attemptsMade: job.attemptsMade,
              processedAt: new Date(job.processedOn),
            },
          });

          archived++;
        } catch (error) {
          this.logger.warn(
            `Failed to archive job ${job.id}: ${getErrorMessage(error)}`,
          );
          // Continue with next job
        }
      }
    }

    this.logger.log(`Archived ${archived} jobs to database`);
    return archived;
  }

  /**
   * Remove jobs from Redis DLQ that have been archived
   */
  private async removeArchivedJobsFromDlq(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.dlqRetentionDays);

    this.logger.log(
      `Removing archived jobs from DLQ (older than ${cutoffDate.toISOString()})...`,
    );

    const failedJobs = await this.dlqQueue.getFailed(0, -1);
    let removed = 0;

    for (const job of failedJobs) {
      if (job.processedOn && job.processedOn < cutoffDate.getTime()) {
        try {
          // Check if job is archived in database
          const archived = await this.prisma.archivedDeadLetterJob.findFirst({
            where: {
              jobId: job.id!,
              queueName: job.queueName,
            },
          });

          if (archived) {
            await job.remove();
            removed++;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to remove job ${job.id} from DLQ: ${getErrorMessage(error)}`,
          );
        }
      }
    }

    this.logger.log(`Removed ${removed} jobs from DLQ`);
    return removed;
  }

  /**
   * Delete archived jobs older than archive retention period
   */
  private async deleteOldArchivedJobs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.archiveRetentionDays);

    this.logger.log(
      `Deleting archived jobs older than ${cutoffDate.toISOString()}...`,
    );

    const result = await this.prisma.archivedDeadLetterJob.deleteMany({
      where: {
        archivedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} archived jobs from database`);
    return result.count;
  }

  /**
   * Get current DLQ size
   */
  async getDlqSize(): Promise<number> {
    const failedCount = await this.dlqQueue.getFailedCount();
    return failedCount;
  }

  /**
   * Get current archive size
   */
  async getArchiveSize(): Promise<number> {
    const count = await this.prisma.archivedDeadLetterJob.count();
    return count;
  }

  /**
   * Get DLQ metrics
   */
  async getMetrics(): Promise<{
    dlqSize: number;
    archiveSize: number;
    oldestDlqJob: Date | null;
    oldestArchivedJob: Date | null;
    retentionDays: number;
    archiveRetentionDays: number;
  }> {
    const dlqSize = await this.getDlqSize();
    const archiveSize = await this.getArchiveSize();

    // Get oldest job in DLQ
    const failedJobs = await this.dlqQueue.getFailed(0, 0);
    const oldestDlqJob = failedJobs[0]?.processedOn
      ? new Date(failedJobs[0].processedOn)
      : null;

    // Get oldest archived job
    const oldestArchived = await this.prisma.archivedDeadLetterJob.findFirst({
      orderBy: { archivedAt: 'asc' },
      select: { archivedAt: true },
    });

    return {
      dlqSize,
      archiveSize,
      oldestDlqJob,
      oldestArchivedJob: oldestArchived?.archivedAt || null,
      retentionDays: this.dlqRetentionDays,
      archiveRetentionDays: this.archiveRetentionDays,
    };
  }

  /**
   * Manually retry a job from archive
   */
  async retryArchivedJob(archivedJobId: string): Promise<void> {
    const archivedJob = await this.prisma.archivedDeadLetterJob.findUnique({
      where: { id: archivedJobId },
    });

    if (!archivedJob) {
      throw new Error(`Archived job ${archivedJobId} not found`);
    }

    this.logger.log(
      `Retrying archived job ${archivedJobId} from queue ${archivedJob.queueName}`,
    );

    // Re-add job to original queue (not DLQ)
    // Note: This requires access to the original queue
    // For now, we'll log that manual retry is requested
    // Implementation would require queue injection for all queues

    throw new Error('Manual retry not yet implemented - requires queue access');
  }
}

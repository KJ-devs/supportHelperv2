import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DlqCleanupJobData } from '../workers/dlq-cleanup.worker';

/**
 * DLQ Cleanup Scheduler Service
 *
 * Schedules daily DLQ cleanup jobs using BullMQ repeatable jobs
 * Default: Every day at 2:00 AM UTC
 */
@Injectable()
export class DlqCleanupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DlqCleanupSchedulerService.name);

  constructor(
    @InjectQueue('dlq-cleanup') private readonly dlqCleanupQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<string>('DLQ_CLEANUP_ENABLED', 'true') === 'true';

    if (!isEnabled) {
      this.logger.warn('DLQ cleanup scheduler is DISABLED');
      return;
    }

    // Schedule daily cleanup at 2 AM UTC
    const cronExpression = this.configService.get<string>(
      'DLQ_CLEANUP_CRON',
      '0 2 * * *', // Default: 2 AM UTC every day
    );

    try {
      // Remove existing repeatable jobs to avoid duplicates
      const repeatableJobs = await this.dlqCleanupQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.dlqCleanupQueue.removeRepeatableByKey(job.key);
      }

      // Add new repeatable job
      await this.dlqCleanupQueue.add(
        'daily-cleanup',
        { triggeredBy: 'cron' } as DlqCleanupJobData,
        {
          repeat: {
            pattern: cronExpression,
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      this.logger.log(`DLQ cleanup scheduled with cron: ${cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to schedule DLQ cleanup: ${error.message}`);
    }
  }

  /**
   * Manually trigger cleanup job
   */
  async triggerManualCleanup(): Promise<void> {
    this.logger.log('Manually triggering DLQ cleanup job...');
    await this.dlqCleanupQueue.add(
      'manual-cleanup',
      { triggeredBy: 'manual' } as DlqCleanupJobData,
      {
        priority: 1,
      },
    );
  }
}

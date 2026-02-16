import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queues.module';

/**
 * UsageSnapshotSchedulerService
 *
 * Schedules a repeatable job to snapshot usage metrics monthly.
 * Job runs at 00:00 on the 1st of every month.
 */
@Injectable()
export class UsageSnapshotSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(UsageSnapshotSchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.USAGE_SNAPSHOT)
    private readonly usageSnapshotQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      // Add repeatable job: runs at 00:00 on the 1st of every month
      await this.usageSnapshotQueue.add(
        'monthly-snapshot',
        {},
        {
          repeat: {
            pattern: '0 0 1 * *', // Cron: At 00:00 on day-of-month 1
          },
          jobId: 'usage-snapshot-monthly',
        },
      );

      this.logger.log(
        'Usage snapshot scheduled: Runs at 00:00 on the 1st of every month',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to schedule usage snapshot job: ${errorMessage}`,
      );
    }
  }
}

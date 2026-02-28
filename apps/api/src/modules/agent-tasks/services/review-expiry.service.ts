import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ValidationModeService } from './validation-mode.service';

const REVIEW_EXPIRY_QUEUE = 'review-expiry';

/**
 * Registers a repeatable job that runs every hour to expire stale review requests.
 */
@Injectable()
export class ReviewExpiryScheduler implements OnModuleInit {
  private readonly logger = new Logger(ReviewExpiryScheduler.name);

  constructor(
    @InjectQueue(REVIEW_EXPIRY_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    // Remove any existing repeatable job before adding a new one
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    await this.queue.add(
      'expire-stale-reviews',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // every hour
        },
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    );

    this.logger.log('Registered review expiry repeatable job (every hour)');
  }
}

/**
 * Processes the repeatable review expiry job.
 */
@Processor(REVIEW_EXPIRY_QUEUE)
export class ReviewExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewExpiryProcessor.name);

  constructor(
    private readonly validationModeService: ValidationModeService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ expired: number }> {
    this.logger.log('Running review expiry check...');
    const expired = await this.validationModeService.expireStaleReviews();
    this.logger.log(`Review expiry check complete: ${expired} task(s) expired`);
    return { expired };
  }
}

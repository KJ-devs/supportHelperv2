import { registerAs } from '@nestjs/config';
import { QueueOptions } from 'bullmq';

/**
 * BullMQ Queue Configuration
 *
 * Retry Strategy (Exponential Backoff):
 * - Attempt 1: 1 minute delay
 * - Attempt 2: 5 minutes delay
 * - Attempt 3: 15 minutes delay
 * - Attempt 4: 1 hour delay
 *
 * After max retries, jobs are moved to dead letter queue
 */
export default registerAs('queue', () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisUrlParsed = new URL(redisUrl);

  const connection = {
    host: redisUrlParsed.hostname,
    port: parseInt(redisUrlParsed.port || '6379', 10),
    ...(redisUrlParsed.password && { password: redisUrlParsed.password }),
  };

  /**
   * Exponential backoff calculation
   * Returns delay in milliseconds based on attempt number
   */
  const calculateBackoff = (attemptsMade: number): number => {
    // Custom exponential backoff: 1min, 5min, 15min, 1hr
    const delays: number[] = [
      60 * 1000,      // 1 minute
      5 * 60 * 1000,  // 5 minutes
      15 * 60 * 1000, // 15 minutes
      60 * 60 * 1000, // 1 hour
    ];

    const index = Math.max(0, Math.min(attemptsMade - 1, delays.length - 1));
    return delays[index]!; // Non-null assertion - index is guaranteed valid
  };

  const defaultJobOptions = {
    attempts: 4, // Increased from 3 to support 4 retry attempts
    backoff: {
      type: 'custom' as const,
      // Custom backoff function
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // 7 days
      count: 1000,
    },
    removeOnFail: false, // Don't auto-remove failed jobs - DLQ will handle
  };

  return {
    connection,
    defaultJobOptions,
    calculateBackoff, // Export custom backoff function

    // Dead Letter Queue configuration
    deadLetterQueue: {
      name: 'dead-letter',
      connection,
      defaultJobOptions: {
        attempts: 1, // No retries in DLQ
        removeOnComplete: {
          age: 90 * 24 * 60 * 60, // 90 days retention
          count: 10000,
        },
        removeOnFail: false,
      },
    } as QueueOptions,

    // Queue-specific configuration
    queues: {
      'video-analysis': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 5,
          attempts: 4,
        },
      } as QueueOptions,

      'github-sync': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 3,
          attempts: 4,
        },
      } as QueueOptions,

      'agent-orchestration': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 10,
          attempts: 5, // Extra retry for agent jobs
        },
      } as QueueOptions,

      'integration-sync': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 2,
          attempts: 4,
        },
      } as QueueOptions,
    },

    // Worker configuration
    worker: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
      limiter: {
        max: 100, // Max 100 jobs
        duration: 60000, // per minute
      },
      settings: {
        // Custom backoff strategy
        backoffStrategy: calculateBackoff,
      },
    },
  };
});

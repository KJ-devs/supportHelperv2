import { registerAs } from '@nestjs/config';
import { QueueOptions } from 'bullmq';

/**
 * BullMQ Queue Configuration
 */
export default registerAs('queue', () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisUrlParsed = new URL(redisUrl);

  const connection = {
    host: redisUrlParsed.hostname,
    port: parseInt(redisUrlParsed.port || '6379', 10),
    ...(redisUrlParsed.password && { password: redisUrlParsed.password }),
  };

  const defaultJobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 10000, // 10 seconds
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // 7 days
      count: 1000,
    },
    removeOnFail: {
      age: 30 * 24 * 60 * 60, // 30 days
      count: 5000,
    },
  };

  return {
    connection,
    defaultJobOptions,

    // Queue-specific configuration
    queues: {
      'video-analysis': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 5,
        },
      } as QueueOptions,

      'github-sync': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 3,
        },
      } as QueueOptions,

      'agent-orchestration': {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          priority: 10,
          attempts: 5,
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
    },
  };
});

import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import queueConfig from '../config/queue.config';

export const QUEUE_NAMES = {
  VIDEO_ANALYSIS: 'video-analysis',
  GITHUB_SYNC: 'github-sync',
  AGENT_ORCHESTRATION: 'agent-orchestration',
  INTEGRATION_SYNC: 'integration-sync',
  CODEBASE_INDEXING: 'codebase-indexing',
  BACKUP: 'backup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Queues Module
 *
 * Configures BullMQ queues for all worker types:
 * - video-analysis: Video processing pipeline
 * - github-sync: GitHub bidirectional sync
 * - agent-orchestration: AI agent tasks
 * - integration-sync: Third-party integration sync (Slack, Discord, Notion, etc.)
 *
 * Shared Redis connection with apps/api
 * Concurrency: 10 jobs simultaneous
 * Retry: 3 attempts with exponential backoff
 */
@Global()
@Module({
  imports: [
    ConfigModule.forFeature(queueConfig),

    // BullMQ Root Module with shared connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return {
          connection: queueConf.connection,
          defaultJobOptions: queueConf.defaultJobOptions,
        };
      },
    }),

    // Video Analysis Queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.VIDEO_ANALYSIS,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return {
          defaultJobOptions: {
            ...queueConf.defaultJobOptions,
            priority: 5,
          },
        };
      },
    }),

    // GitHub Sync Queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.GITHUB_SYNC,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return {
          defaultJobOptions: {
            ...queueConf.defaultJobOptions,
            priority: 3,
          },
        };
      },
    }),

    // Agent Orchestration Queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.AGENT_ORCHESTRATION,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return {
          defaultJobOptions: {
            ...queueConf.defaultJobOptions,
            priority: 10,
            attempts: 5,
          },
        };
      },
    }),

    // Integration Sync Queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.INTEGRATION_SYNC,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return {
          defaultJobOptions: {
            ...queueConf.defaultJobOptions,
            priority: 2,
            attempts: 4,
          },
        };
      },
    }),

    // Codebase Indexing Queue
    BullModule.registerQueue({
      name: QUEUE_NAMES.CODEBASE_INDEXING,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    }),

    // Backup Queue
    BullModule.registerQueue({
      name: QUEUE_NAMES.BACKUP,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),

    // Dead Letter Queue
    BullModule.registerQueueAsync({
      name: 'dead-letter',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConf = configService.get('queue');
        return queueConf.deadLetterQueue;
      },
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}

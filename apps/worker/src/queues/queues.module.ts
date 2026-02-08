import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import queueConfig from '../config/queue.config';

export const QUEUE_NAMES = {
  VIDEO_ANALYSIS: 'video-analysis',
  GITHUB_SYNC: 'github-sync',
  AGENT_ORCHESTRATION: 'agent-orchestration',
  INTEGRATION_SYNC: 'integration-sync',
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
            attempts: 3,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}

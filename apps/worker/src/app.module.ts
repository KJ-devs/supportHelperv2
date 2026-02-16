import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueuesModule } from './queues';
import { ProcessorsModule } from './processors';
import { ServicesModule } from './services/services.module';
import { HealthModule } from './health';
import { LoggerModule } from './common/logger/logger.module';

// Config imports
import ffmpegConfig from './config/ffmpeg.config';
import ocrConfig from './config/ocr.config';
import openaiConfig from './config/openai.config';
import yoloConfig from './config/yolo.config';
import queueConfig from './config/queue.config';

/**
 * Worker App Module
 *
 * Main module for the AI Worker service.
 *
 * Workers:
 * - VideoAnalysisWorker: Video processing pipeline
 * - GithubSyncWorker: GitHub bidirectional sync
 * - AgentWorker: AI agent orchestration
 * - IntegrationSyncWorker: Third-party integration sync (Slack, Discord, Notion, etc.)
 * - CodebaseIndexingWorker: Codebase embedding indexing for AI-powered code search
 *
 * Configuration:
 * - Shared Redis with apps/api
 * - Concurrency: 10 jobs simultaneous
 * - Retry: 3 attempts with exponential backoff
 * - Priority queues
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [ffmpegConfig, ocrConfig, openaiConfig, yoloConfig, queueConfig],
    }),

    // Logging
    LoggerModule,

    // Services
    ServicesModule,

    // Queues
    QueuesModule,

    // Processors (Workers)
    ProcessorsModule,

    // Health checks
    HealthModule,
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { validateEnvironmentVariables } from './config/validate-env';
import { PinoLoggerService } from './common/logger/pino-logger.service';

async function bootstrap() {
  // Validate environment variables BEFORE NestJS initialization
  validateEnvironmentVariables();

  const logger = new Logger('WorkerBootstrap');

  logger.log('Starting Support Helper Worker Service...');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get and attach the Pino logger
  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Worker service shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during worker shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception in Worker', error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection in Worker', { reason });
  });

  // No HTTP server needed for workers, but we can still start one for health checks
  const port = process.env.WORKER_PORT || 3003;
  await app.listen(port);

  logger.log(`Worker service started on port ${port}`);
  logger.log('Workers active:');
  logger.log('  - VideoAnalysisWorker (video-analysis queue, 4 retries)');
  logger.log('  - GithubSyncWorker (github-sync queue, 4 retries)');
  logger.log('  - AgentWorker (agent-orchestration queue, 5 retries)');
  logger.log('  - IntegrationSyncWorker (integration-sync queue, 4 retries)');
  logger.log('  - BackupWorker (backup queue, 3 retries)');
  logger.log('  - DeadLetterWorker (dead-letter queue)');
  logger.log('Retry Strategy: Exponential backoff (1min, 5min, 15min, 1hr)');
  logger.log(`Concurrency: ${process.env.WORKER_CONCURRENCY || 10} jobs`);
  logger.log(`Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
}

bootstrap().catch(error => {
  console.error('Failed to start worker service:', error);
  process.exit(1);
});

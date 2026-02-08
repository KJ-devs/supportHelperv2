import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  logger.log('Starting Support Helper Worker Service...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // No HTTP server needed for workers, but we can still start one for health checks
  const port = process.env.WORKER_PORT || 3001;
  await app.listen(port);

  logger.log(`Worker service started on port ${port}`);
  logger.log('Workers active:');
  logger.log('  - VideoAnalysisWorker (video-analysis queue)');
  logger.log('  - GithubSyncWorker (github-sync queue)');
  logger.log('  - AgentWorker (agent-orchestration queue)');
  logger.log(`Concurrency: ${process.env.WORKER_CONCURRENCY || 10} jobs`);
  logger.log(`Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
}

bootstrap().catch(error => {
  console.error('Failed to start worker service:', error);
  process.exit(1);
});

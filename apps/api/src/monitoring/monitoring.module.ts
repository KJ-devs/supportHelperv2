import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryService } from './sentry.service';
import { LoggerService } from './logger.service';
import { PostHogService } from './posthog.service';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [SentryService, LoggerService, PostHogService, HealthService, MetricsService],
  exports: [SentryService, LoggerService, PostHogService, HealthService, MetricsService],
})
export class MonitoringModule {}

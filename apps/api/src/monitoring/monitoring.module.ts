import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryService } from './sentry.service';
import { LoggerService } from './logger.service';
import { PostHogService } from './posthog.service';
import { HealthService } from './health.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SentryService, LoggerService, PostHogService, HealthService],
  exports: [SentryService, LoggerService, PostHogService, HealthService],
})
export class MonitoringModule {}

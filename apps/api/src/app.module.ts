import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import Redis from 'ioredis';
import { ThrottlerStorageRedisService } from './common/services/throttler-storage-redis.service';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { GracefulShutdownService } from './common/services/graceful-shutdown.service';

// Configuration
import configs, { validate } from './config';

// Core Modules
import { PrismaModule } from './prisma/prisma.module';
import { RedisCacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CorrelationIdMiddleware } from './monitoring/correlation-id.middleware';
import { EncryptionModule } from './common/encryption.module';

// Authentication & Authorization
import { AuthModule } from './auth/auth.module';

// Multi-tenant Core
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { ApplicationsModule } from './applications/applications.module';

// Business Logic Modules
import { TicketsModule } from './modules/tickets/tickets.module';
import { MediaModule } from './modules/media/media.module';

// AI & Automation
import { AIModule } from './ai/ai.module';
import { AiConfigModule } from './modules/ai-config/ai-config.module';
import { AgentModule } from './modules/agent/agent.module';

// Integrations
import { GithubModule } from './modules/github/github.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

// Feedback & Learning
import { FeedbackModule } from './modules/feedback/feedback.module';

// Analytics & Reporting
import { AnalyticsModule } from './modules/analytics/analytics.module';

// Codebase Indexing
import { CodebaseIndexModule } from './modules/codebase-index/codebase-index.module';

// Agent Tasks (Code Analysis)
import { AgentTasksModule } from './modules/agent-tasks/agent-tasks.module';

// Agent V2 (Deep Analysis)
import { AgentV2Module } from './modules/agent-v2/agent-v2.module';

// Notifications
import { NotificationModule } from './modules/notifications/notification.module';

// Setup Wizard
import { SetupModule } from './modules/setup/setup.module';

// License Verification
import { LicenseModule } from './modules/license/license.module';

// Audit Logging
import { AuditModule } from './modules/audit/audit.module';

// Backup & Restore
import { BackupModule } from './modules/backup/backup.module';

// SSO Authentication
import { SsoModule } from './modules/auth/sso/sso.module';

// Triage (Automatic ticket classification & routing)
import { TriageModule } from './modules/triage/triage.module';

/**
 * Root Application Module
 *
 * Architecture: Core Services Layer
 * - Multi-tenant isolation
 * - JWT + SDK key authentication
 * - Rate limiting with Redis storage
 * - Global configuration
 */
@Module({
  imports: [
    // Global Configuration with Validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      load: configs,
      validate,
      cache: true,
    }),

    // BullMQ Queue Configuration (Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('database.redisUrl') || 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
            lazyConnect: true,
          },
        };
      },
    }),

    // Rate Limiting with Redis Storage
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('database.redisUrl') || 'redis://localhost:6379';
        const url = new URL(redisUrl);

        const redisClient = new Redis({
          host: url.hostname,
          port: parseInt(url.port || '6379', 10),
          maxRetriesPerRequest: null,
          connectTimeout: 5000,
          lazyConnect: true,
        });

        return {
          throttlers: [
            {
              name: 'public',
              ttl: 60000, // 1 minute
              limit: 10,
            },
            {
              name: 'authenticated',
              ttl: 60000, // 1 minute
              limit: 100,
            },
            {
              name: 'sdk',
              ttl: 60000, // 1 minute
              limit: 50,
            },
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
        };
      },
    }),

    // Event Emitter (global)
    EventEmitterModule.forRoot(),

    // Core Infrastructure
    PrismaModule,
    RedisCacheModule,
    EncryptionModule,
    MonitoringModule,
    HealthModule,
    LoggerModule,
    MetricsModule,

    // Authentication & Authorization
    AuthModule,
    TenantsModule,
    UsersModule,
    ApplicationsModule,

    // Business Logic
    TicketsModule,
    MediaModule,

    // AI & Automation
    AIModule,
    AiConfigModule,
    AgentModule,

    // Integrations
    GithubModule,
    IntegrationsModule,

    // Feedback & Learning
    FeedbackModule,

    // Analytics
    AnalyticsModule,

    // Codebase Indexing
    CodebaseIndexModule,

    // Agent Tasks (Code Analysis)
    AgentTasksModule,

    // Agent V2 (Deep Analysis with GitHub code investigation)
    AgentV2Module,

    // Notifications
    NotificationModule,

    // Setup Wizard
    SetupModule,

    // License Verification
    LicenseModule,

    // Audit Logging
    AuditModule,

    // Backup & Restore
    BackupModule,

    // SSO Authentication
    SsoModule,

    // Triage (Automatic ticket classification & routing)
    TriageModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global throttler exception filter
    {
      provide: APP_FILTER,
      useClass: ThrottlerExceptionFilter,
    },
    // Global structured logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: StructuredLoggingInterceptor,
    },
    // Global metrics interceptor (only active when PROMETHEUS_ENABLED=true)
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // Graceful shutdown service (handles BullMQ queue cleanup)
    GracefulShutdownService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request ID and correlation ID middleware to all routes
    consumer
      .apply(RequestIdMiddleware, CorrelationIdMiddleware)
      .forRoutes('*');
  }
}

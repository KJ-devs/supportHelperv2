import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import Redis from 'ioredis';
import { SmartThrottlerGuard } from './common/guards/smart-throttler.guard';

// Configuration
import configs, { validate } from './config';

// Core Modules
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { CorrelationIdMiddleware } from './monitoring/correlation-id.middleware';

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
import { AgentModule } from './modules/agent/agent.module';

// Integrations
import { GithubModule } from './modules/github/github.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

// Feedback & Learning
import { FeedbackModule } from './modules/feedback/feedback.module';

// Analytics & Reporting
import { AnalyticsModule } from './modules/analytics/analytics.module';

// Throttler
import { ThrottlerExceptionFilter } from './common/throttler';

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
        const redisUrl =
          config.get<string>('database.redisUrl') || 'redis://localhost:6379';
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
        const redisUrl =
          config.get<string>('database.redisUrl') || 'redis://localhost:6379';
        const redis = new Redis(redisUrl);

        return {
          throttlers: [
            {
              name: 'public',
              ttl: 60000, // 1 minute
              limit: 10, // 10 requests per minute per IP
            },
            {
              name: 'authenticated',
              ttl: 60000, // 1 minute
              limit: 100, // 100 requests per minute per user
            },
            {
              name: 'sdk',
              ttl: 60000, // 1 minute
              limit: 50, // 50 requests per minute per SDK key
            },
          ],
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),

    // Core Infrastructure
    PrismaModule,
    MonitoringModule,
    HealthModule,

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
    AgentModule,

    // Integrations
    GithubModule,
    IntegrationsModule,

    // Feedback & Learning
    FeedbackModule,

    // Analytics
    AnalyticsModule,
  ],
  providers: [
    // Global rate limiting guard (default)
    {
      provide: APP_GUARD,
      useClass: SmartThrottlerGuard,
    },
    // Rate limit exception filter
    {
      provide: APP_FILTER,
      useClass: ThrottlerExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply correlation ID middleware to all routes
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

// Services
import { AuthService } from './auth.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';

// Guards
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Middleware
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';

// Dependencies
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Authentication Module
 *
 * Provides:
 * - JWT authentication for dashboard users
 * - API Key authentication for SDK clients
 * - Multi-tenant context management
 * - Row-Level Security support
 *
 * Global Guards:
 * - JwtAuthGuard is applied globally (routes must use @Public() to skip)
 *
 * Middleware:
 * - TenantContextMiddleware sets PostgreSQL session variable for RLS
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyStrategy,
    // Apply JWT guard globally to all routes
    // Routes can use @Public() decorator to skip authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant context middleware to all routes
    // This sets the PostgreSQL session variable for Row-Level Security
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes('*');
  }
}

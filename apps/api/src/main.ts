import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, InternalServerErrorException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RateLimitLoggingInterceptor } from './common/interceptors/rate-limit-logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { validateEnvironmentVariables } from './config/validate-env';

// BigInt cannot be serialized by JSON.stringify by default.
// This polyfill converts BigInt to Number for JSON responses (e.g. Media.fileSize).
interface BigInt {
  toJSON(): number;
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  // Validate environment variables BEFORE NestJS initialization
  validateEnvironmentVariables();

  // Create the app
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const logger = new Logger('Bootstrap');

  // Validate JWT secret in production — reject the insecure default
  const nodeEnv = config.get<string>('app.nodeEnv') || 'development';
  const jwtSecret = config.get<string>('JWT_SECRET');
  const insecureDefault = 'your-super-secret-jwt-key-change-in-production';
  if (nodeEnv === 'production' && (!jwtSecret || jwtSecret === insecureDefault)) {
    throw new InternalServerErrorException(
      'FATAL: JWT_SECRET is not configured for production. ' +
      'Generate a secure secret with: openssl rand -hex 32',
    );
  }

  // Security headers
  app.use(helmet());

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/(.*)'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new RateLimitLoggingInterceptor(),
  );

  // Global JWT guard (will be skipped for @Public() and @SdkAuth() routes)
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // CORS configuration
  const dashboardUrl = config.get<string>('app.dashboardUrl');
  const nodeEnvCors = config.get<string>('app.nodeEnv') || 'development';
  const allowedOrigins = [
    ...(dashboardUrl ? [dashboardUrl] : []),
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  app.enableCors({
    origin: nodeEnvCors === 'production'
      ? allowedOrigins
      : (origin, callback) => {
          // In development, allow file:// (null origin) and any localhost
          if (!origin || origin === 'null' || /^https?:\/\/localhost(:\d+)?$/.test(origin) || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-sdk-key', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  });

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Support Helper API')
    .setDescription(
      'AI-powered technical support platform API with multi-tenant architecture',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'x-sdk-key', in: 'header' },
      'sdk-key',
    )
    .addTag('Authentication', 'User authentication and JWT management')
    .addTag('Tenants', 'Multi-tenant management')
    .addTag('Users', 'User management')
    .addTag('Applications', 'Application and SDK key management')
    .addTag('Tickets', 'Ticket CRUD and management')
    .addTag('Media', 'File upload and S3 management')
    .addTag('AI Agent', 'AI-powered support agent')
    .addTag('Analytics', 'Dashboard analytics and statistics')
    .addTag('GitHub Integration', 'GitHub OAuth and issue sync')
    .addTag('Health', 'Service health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason });
  });

  const port = config.get<number>('app.port') || 3001;
  await app.listen(port);

  // Startup banner
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🚀 Support Helper API is running                      ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  📡 API Server:      http://localhost:${port}            ║`);
  console.log(`║  📚 API Docs:        http://localhost:${port}/api/docs   ║`);
  console.log(`║  🏥 Health Check:    http://localhost:${port}/health     ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  🔐 Environment:     ${(nodeEnv || 'development').toString().padEnd(35)}║`);
  console.log(`║  🗄️  Database:        PostgreSQL + pgvector              ║`);
  console.log(`║  ⚡ Cache:           Redis ${config.get('database.redisUrl') ? '✓' : '✗'}                          ║`);
  console.log(`║  🔍 Search:          Meilisearch ${config.get('meilisearch.host') ? '✓' : '✗'}                    ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

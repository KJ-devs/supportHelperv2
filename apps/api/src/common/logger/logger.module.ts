import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PinoLoggerService } from './pino-logger.service';

/**
 * Global Logger Module
 *
 * Provides structured logging with Pino across the application.
 * Automatically includes correlation ID, sanitization, and environment-aware formatting.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggerModule {}

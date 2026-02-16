import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PinoLoggerService } from './pino-logger.service';

/**
 * Global Logger Module for Worker
 *
 * Provides structured logging with Pino across worker processes.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggerModule {}

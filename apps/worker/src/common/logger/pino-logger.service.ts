import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

const SENSITIVE_FIELDS = [
  'password',
  'api_key',
  'apiKey',
  'token',
  'secret',
  'authorization',
  'x-sdk-key',
  'credit_card',
  'creditCard',
  'ssn',
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
];

const REDACTED = '[REDACTED]';

function getPinoRedactPaths(): string[] {
  return SENSITIVE_FIELDS.map(field => `*.${field}`);
}

/**
 * Pino Logger Service for Worker
 *
 * Provides structured logging with Pino for background worker processes.
 * Includes correlation ID support for job tracing.
 */
@Injectable()
export class PinoLoggerService implements NestLoggerService {
  private logger: pino.Logger;
  private context?: string;

  constructor(private readonly config: ConfigService) {
    this.logger = this.createLogger();
  }

  private createLogger(): pino.Logger {
    const isDev = this.config.get('NODE_ENV') === 'development';
    const logLevel = this.config.get<string>('LOG_LEVEL') || 'info';

    const pinoConfig: pino.LoggerOptions = {
      level: logLevel,
      redact: {
        paths: getPinoRedactPaths(),
        censor: REDACTED,
      },
      base: {
        service: 'support-helper-worker',
        environment: this.config.get('NODE_ENV'),
        pid: process.pid,
        hostname: require('os').hostname(),
      },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          }
        : undefined,
    };

    return pino(pinoConfig);
  }

  private getMeta(optionalParams: unknown[]): Record<string, unknown> {
    const meta: Record<string, unknown> = {};

    if (this.context) {
      meta.context = this.context;
    }

    for (const param of optionalParams) {
      if (param instanceof Error) {
        meta.error = {
          name: param.name,
          message: param.message,
          stack: param.stack,
        };
      } else if (typeof param === 'object' && param !== null) {
        Object.assign(meta, param);
      } else if (typeof param === 'string') {
        meta.additionalContext = param;
      }
    }

    return meta;
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    return JSON.stringify(message);
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.logger.info(this.getMeta(optionalParams), this.formatMessage(message));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.logger.error(this.getMeta(optionalParams), this.formatMessage(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.logger.warn(this.getMeta(optionalParams), this.formatMessage(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.logger.debug(this.getMeta(optionalParams), this.formatMessage(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.logger.debug(this.getMeta(optionalParams), this.formatMessage(message));
  }

  /**
   * Log job processing with structured data
   */
  logJob(
    queue: string,
    jobId: string,
    status: 'started' | 'completed' | 'failed',
    meta?: Record<string, unknown>
  ) {
    this.logger.info({
      job: {
        queue,
        jobId,
        status,
      },
      ...meta,
    }, `Job ${status}`);
  }

  /**
   * Get the underlying pino logger instance
   */
  getLogger(): pino.Logger {
    return this.logger;
  }
}

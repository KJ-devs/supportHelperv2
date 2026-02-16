import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { sanitizeLogObject, getPinoRedactPaths } from './log-sanitizer';
import { getCorrelationId } from '../../monitoring/logger.service';

@Injectable()
export class PinoLoggerService implements NestLoggerService {
  private logger: pino.Logger;
  private context?: string;

  constructor(private readonly config: ConfigService) {
    this.logger = this.createLogger();
  }

  private createLogger(): pino.Logger {
    const isDev = this.config.get('app.nodeEnv') === 'development';
    const logLevel = this.config.get<string>('LOG_LEVEL') || 'info';

    const pinoConfig: pino.LoggerOptions = {
      level: logLevel,
      // Redact sensitive fields
      redact: {
        paths: getPinoRedactPaths(),
        censor: '[REDACTED]',
      },
      // Base metadata
      base: {
        service: 'support-helper-api',
        environment: this.config.get('app.nodeEnv'),
        version: this.config.get('app.version') || '0.1.0',
        pid: process.pid,
        hostname: require('os').hostname(),
      },
      // Timestamp in ISO format
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      // Format output based on environment
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

  /**
   * Add correlation ID and context to log metadata
   */
  private getMeta(optionalParams: unknown[]): Record<string, unknown> {
    const meta: Record<string, unknown> = {
      correlationId: getCorrelationId(),
    };

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
        // Sanitize before adding to meta
        Object.assign(meta, sanitizeLogObject(param));
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
    // Pino doesn't have verbose, map to debug
    this.logger.debug(this.getMeta(optionalParams), this.formatMessage(message));
  }

  /**
   * Structured logging helpers
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    meta?: Record<string, unknown>
  ) {
    const sanitized = sanitizeLogObject(meta || {}) as Record<string, unknown>;
    this.logger.info({
      correlationId: getCorrelationId(),
      http: {
        method,
        url,
        statusCode,
        duration,
      },
      ...sanitized,
    }, 'HTTP Request');
  }

  logDatabaseQuery(query: string, duration: number, meta?: Record<string, unknown>) {
    const sanitized = sanitizeLogObject(meta || {}) as Record<string, unknown>;
    this.logger.debug({
      correlationId: getCorrelationId(),
      database: {
        query: query.slice(0, 500), // Truncate long queries
        duration,
      },
      ...sanitized,
    }, 'Database Query');
  }

  logExternalService(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    meta?: Record<string, unknown>
  ) {
    const sanitized = sanitizeLogObject(meta || {}) as Record<string, unknown>;
    this.logger.info({
      correlationId: getCorrelationId(),
      external: {
        service,
        operation,
        duration,
        success,
      },
      ...sanitized,
    }, 'External Service Call');
  }

  logSecurityEvent(event: string, userId?: string, meta?: Record<string, unknown>) {
    const sanitized = sanitizeLogObject(meta || {}) as Record<string, unknown>;
    this.logger.warn({
      correlationId: getCorrelationId(),
      security: {
        event,
        userId,
      },
      ...sanitized,
    }, 'Security Event');
  }

  /**
   * Get the underlying pino logger instance for advanced usage
   */
  getLogger(): pino.Logger {
    return this.logger;
  }
}

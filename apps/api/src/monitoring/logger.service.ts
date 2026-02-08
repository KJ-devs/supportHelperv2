import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// Async local storage for correlation IDs
const correlationStorage = new AsyncLocalStorage<{ correlationId: string }>();

export function getCorrelationId(): string {
  const store = correlationStorage.getStore();
  return store?.correlationId || 'no-correlation-id';
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run({ correlationId }, fn);
}

export function generateCorrelationId(): string {
  return uuidv4();
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private logtail: Logtail | null = null;
  private context?: string;

  constructor(private readonly config: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const isDev = this.config.get('app.nodeEnv') === 'development';
    const betterStackToken = this.config.get<string>('monitoring.betterStack.sourceToken');
    const betterStackEnabled = this.config.get<boolean>('monitoring.betterStack.enabled');

    const transports: winston.transport[] = [];

    // Console transport (always enabled)
    transports.push(
      new winston.transports.Console({
        format: isDev
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              winston.format.printf(
                ({ timestamp, level, message, context, correlationId, ...meta }) => {
                  const ctx = context ? `[${context}]` : '';
                  const cid = correlationId ? `[${String(correlationId).slice(0, 8)}]` : '';
                  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                  return `${timestamp} ${level} ${ctx}${cid} ${message}${metaStr}`;
                }
              )
            )
          : winston.format.combine(winston.format.timestamp(), winston.format.json()),
      })
    );

    // Better Stack (Logtail) transport
    if (betterStackEnabled && betterStackToken) {
      this.logtail = new Logtail(betterStackToken);
      transports.push(new LogtailTransport(this.logtail));
      console.log('[Logger] Better Stack transport enabled');
    }

    this.logger = winston.createLogger({
      level: isDev ? 'debug' : 'info',
      defaultMeta: {
        service: 'support-helper-api',
        environment: this.config.get('app.nodeEnv'),
        version: this.config.get('app.version') || '0.1.0',
      },
      transports,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    return JSON.stringify(message);
  }

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
        Object.assign(meta, param);
      } else if (typeof param === 'string') {
        meta.context = param;
      }
    }

    return meta;
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.logger.info(this.formatMessage(message), this.getMeta(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.logger.error(this.formatMessage(message), this.getMeta(optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.logger.warn(this.formatMessage(message), this.getMeta(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.logger.debug(this.formatMessage(message), this.getMeta(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.logger.verbose(this.formatMessage(message), this.getMeta(optionalParams));
  }

  // Structured logging helpers
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    meta?: Record<string, unknown>
  ) {
    this.logger.info('HTTP Request', {
      correlationId: getCorrelationId(),
      http: {
        method,
        url,
        statusCode,
        duration,
      },
      ...meta,
    });
  }

  logDatabaseQuery(query: string, duration: number, meta?: Record<string, unknown>) {
    this.logger.debug('Database Query', {
      correlationId: getCorrelationId(),
      database: {
        query: query.slice(0, 500), // Truncate long queries
        duration,
      },
      ...meta,
    });
  }

  logExternalService(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    meta?: Record<string, unknown>
  ) {
    this.logger.info('External Service Call', {
      correlationId: getCorrelationId(),
      external: {
        service,
        operation,
        duration,
        success,
      },
      ...meta,
    });
  }

  logSecurityEvent(event: string, userId?: string, meta?: Record<string, unknown>) {
    this.logger.warn('Security Event', {
      correlationId: getCorrelationId(),
      security: {
        event,
        userId,
      },
      ...meta,
    });
  }

  async flush(): Promise<void> {
    if (this.logtail) {
      await this.logtail.flush();
    }
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

@Injectable()
export class SentryService implements OnModuleInit, OnModuleDestroy {
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const dsn = this.config.get<string>('monitoring.sentry.dsn');
    const enabled = this.config.get<boolean>('monitoring.sentry.enabled');

    if (!enabled || !dsn) {
      console.log('[Sentry] Disabled - No DSN configured');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment: this.config.get<string>('monitoring.sentry.environment'),
        release: this.config.get<string>('monitoring.sentry.release'),
        tracesSampleRate: this.config.get<number>('monitoring.sentry.tracesSampleRate'),
        profilesSampleRate: this.config.get<number>('monitoring.sentry.profilesSampleRate'),
        integrations: [
          nodeProfilingIntegration(),
          Sentry.httpIntegration(),
          Sentry.expressIntegration(),
          Sentry.prismaIntegration(),
        ],
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['x-sdk-key'];
            delete event.request.headers['cookie'];
          }
          return event;
        },
      });

      this.initialized = true;
      console.log('[Sentry] Initialized successfully');
    } catch (error) {
      console.error('[Sentry] Failed to initialize:', error);
    }
  }

  onModuleDestroy() {
    if (this.initialized) {
      Sentry.close(2000);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  captureException(exception: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) return;

    Sentry.withScope(scope => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(exception);
    });
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
    if (!this.initialized) return;
    Sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; email?: string; tenantId?: string }): void {
    if (!this.initialized) return;
    Sentry.setUser({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    } as Sentry.User);
  }

  clearUser(): void {
    if (!this.initialized) return;
    Sentry.setUser(null);
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.initialized) return;
    Sentry.addBreadcrumb(breadcrumb);
  }

  startTransaction(name: string, op: string): Sentry.Span | undefined {
    if (!this.initialized) return undefined;
    return Sentry.startInactiveSpan({ name, op });
  }

  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    Sentry.setTag(key, value);
  }

  setRelease(release: string): void {
    if (!this.initialized) return;
    Sentry.setTag('release', release);
  }
}

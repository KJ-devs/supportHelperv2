import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';

// Analytics event types
export enum AnalyticsEvent {
  // Ticket events
  TICKET_CREATED = 'ticket_created',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_RESOLVED = 'ticket_resolved',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_CLASSIFIED = 'ticket_classified',

  // Media events
  VIDEO_UPLOADED = 'video_uploaded',
  VIDEO_ANALYZED = 'video_analyzed',
  SCREENSHOT_UPLOADED = 'screenshot_uploaded',

  // User events
  USER_SIGNED_UP = 'user_signed_up',
  USER_LOGGED_IN = 'user_logged_in',
  USER_LOGGED_OUT = 'user_logged_out',
  USER_INVITED = 'user_invited',

  // SDK events
  SDK_INITIALIZED = 'sdk_initialized',
  SDK_REPORT_SUBMITTED = 'sdk_report_submitted',

  // AI events
  AI_ANALYSIS_STARTED = 'ai_analysis_started',
  AI_ANALYSIS_COMPLETED = 'ai_analysis_completed',
  AI_ANALYSIS_FAILED = 'ai_analysis_failed',
  AI_FEEDBACK_RECEIVED = 'ai_feedback_received',

  // Integration events
  GITHUB_ISSUE_CREATED = 'github_issue_created',
  GITHUB_ISSUE_SYNCED = 'github_issue_synced',

  // Feature flag events
  FEATURE_FLAG_EVALUATED = 'feature_flag_evaluated',
}

interface UserProperties {
  email?: string;
  name?: string;
  tenantId?: string;
  role?: string;
  plan?: string;
  createdAt?: string;
}

@Injectable()
export class PostHogService implements OnModuleInit, OnModuleDestroy {
  private client: PostHog | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('monitoring.posthog.apiKey');
    const host = this.config.get<string>('monitoring.posthog.host');
    this.enabled = this.config.get<boolean>('monitoring.posthog.enabled') || false;

    if (!this.enabled || !apiKey) {
      console.log('[PostHog] Disabled - No API key configured');
      return;
    }

    try {
      this.client = new PostHog(apiKey, {
        host,
        flushAt: 20,
        flushInterval: 10000,
      });

      console.log('[PostHog] Initialized successfully');
    } catch (error) {
      console.error('[PostHog] Failed to initialize:', error);
      this.enabled = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown();
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Capture a custom event
   */
  capture(
    distinctId: string,
    event: AnalyticsEvent | string,
    properties?: Record<string, unknown>
  ): void {
    if (!this.isEnabled()) return;

    this.client!.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        $lib: 'support-helper-api',
        environment: this.config.get('app.nodeEnv'),
      },
    });
  }

  /**
   * Identify a user with properties
   */
  identify(distinctId: string, properties: UserProperties): void {
    if (!this.isEnabled()) return;

    this.client!.identify({
      distinctId,
      properties: {
        ...properties,
        $set: properties,
      },
    });
  }

  /**
   * Associate a user with a group (tenant)
   */
  groupIdentify(groupType: string, groupKey: string, properties?: Record<string, unknown>): void {
    if (!this.isEnabled()) return;

    this.client!.groupIdentify({
      groupType,
      groupKey,
      properties,
    });
  }

  /**
   * Associate a user with a tenant
   */
  setUserTenant(distinctId: string, tenantId: string, tenantName?: string): void {
    if (!this.isEnabled()) return;

    // Capture group association
    this.capture(distinctId, '$groupidentify', {
      $group_type: 'tenant',
      $group_key: tenantId,
      $group_set: {
        name: tenantName,
        id: tenantId,
      },
    });
  }

  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(
    distinctId: string,
    featureKey: string,
    defaultValue = false
  ): Promise<boolean> {
    if (!this.isEnabled()) return defaultValue;

    try {
      const result = await this.client!.isFeatureEnabled(featureKey, distinctId);

      // Track feature flag evaluation
      this.capture(distinctId, AnalyticsEvent.FEATURE_FLAG_EVALUATED, {
        featureKey,
        enabled: result,
      });

      return result ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Get feature flag payload
   */
  async getFeatureFlagPayload(distinctId: string, featureKey: string): Promise<unknown> {
    if (!this.isEnabled()) return null;

    try {
      return await this.client!.getFeatureFlagPayload(featureKey, distinctId);
    } catch {
      return null;
    }
  }

  /**
   * Get all feature flags for a user
   */
  async getAllFlags(distinctId: string): Promise<Record<string, boolean | string>> {
    if (!this.isEnabled()) return {};

    try {
      return await this.client!.getAllFlags(distinctId);
    } catch {
      return {};
    }
  }

  // Convenience methods for common events

  trackTicketCreated(userId: string, ticketId: string, properties?: Record<string, unknown>): void {
    this.capture(userId, AnalyticsEvent.TICKET_CREATED, {
      ticketId,
      ...properties,
    });
  }

  trackVideoUploaded(
    userId: string,
    mediaId: string,
    properties?: { duration?: number; size?: number; format?: string }
  ): void {
    this.capture(userId, AnalyticsEvent.VIDEO_UPLOADED, {
      mediaId,
      ...properties,
    });
  }

  trackAIAnalysis(
    userId: string,
    ticketId: string,
    status: 'started' | 'completed' | 'failed',
    properties?: Record<string, unknown>
  ): void {
    const event =
      status === 'started'
        ? AnalyticsEvent.AI_ANALYSIS_STARTED
        : status === 'completed'
          ? AnalyticsEvent.AI_ANALYSIS_COMPLETED
          : AnalyticsEvent.AI_ANALYSIS_FAILED;

    this.capture(userId, event, {
      ticketId,
      ...properties,
    });
  }

  trackUserSignUp(userId: string, properties?: UserProperties): void {
    this.capture(userId, AnalyticsEvent.USER_SIGNED_UP, properties as Record<string, unknown>);
    if (properties) {
      this.identify(userId, properties);
    }
  }

  trackUserLogin(userId: string): void {
    this.capture(userId, AnalyticsEvent.USER_LOGGED_IN);
  }

  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flush();
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { EmailService } from './email.service';
import { getErrorMessage } from '../utils/error.utils';

export interface DlqAlertPayload {
  jobId: string;
  queueName: string;
  failedReason: string;
  attemptsMade: number;
  payload: Record<string, unknown>;
  stacktrace?: string[];
  timestamp: Date;
}

@Injectable()
export class DlqAlertService implements OnModuleInit {
  private readonly logger = new Logger(DlqAlertService.name);
  private redis!: Redis;
  private readonly THROTTLE_SECONDS = 5 * 60; // 5 minutes per queue
  private readonly THROTTLE_KEY_PREFIX = 'dlq:alert:throttle:';

  private readonly CRITICAL_QUEUES = [
    'video-analysis',
    'agent-orchestration',
    'github-sync',
    'backup',
  ];

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.logger.log('DlqAlertService initialized with Redis throttling');
  }

  /**
   * Send alerts for a dead-letter job if the queue is critical and not throttled.
   */
  async alertIfNeeded(job: Job): Promise<void> {
    if (!this.CRITICAL_QUEUES.includes(job.queueName)) {
      return;
    }

    if (await this.isThrottled(job.queueName)) {
      this.logger.debug(
        `DLQ alert throttled for queue ${job.queueName} (max 1 per 5 min)`,
      );
      return;
    }

    await this.markThrottled(job.queueName);

    const payload = this.buildPayload(job);

    await Promise.allSettled([
      this.sendEmailAlert(payload),
      this.sendSlackAlert(payload),
    ]);
  }

  private buildPayload(job: Job): DlqAlertPayload {
    return {
      jobId: job.id || 'unknown',
      queueName: job.queueName,
      failedReason: job.failedReason || 'Unknown failure',
      attemptsMade: job.attemptsMade,
      payload: job.data as Record<string, unknown>,
      stacktrace: job.stacktrace,
      timestamp: new Date(),
    };
  }

  /**
   * Send email alert via Resend (EmailService)
   */
  private async sendEmailAlert(alert: DlqAlertPayload): Promise<void> {
    const adminEmail = this.configService.get<string>('DLQ_ALERT_EMAIL');
    if (!adminEmail) {
      this.logger.debug('DLQ_ALERT_EMAIL not configured, skipping email alert');
      return;
    }

    if (!this.emailService.isEnabled()) {
      this.logger.debug('Email service disabled, skipping DLQ email alert');
      return;
    }

    try {
      const payloadPreview = JSON.stringify(alert.payload, null, 2).slice(
        0,
        500,
      );

      await this.emailService.send({
        to: adminEmail,
        subject: `[DLQ ALERT] ${alert.queueName} job failed permanently`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #DC2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #4b5563; }
    pre { background: #1f2937; color: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Dead Letter Queue Alert</h2>
    </div>
    <div class="content">
      <p>A job has permanently failed and been moved to the dead letter queue.</p>
      <div class="field"><span class="label">Queue:</span> ${alert.queueName}</div>
      <div class="field"><span class="label">Job ID:</span> ${alert.jobId}</div>
      <div class="field"><span class="label">Attempts:</span> ${alert.attemptsMade}</div>
      <div class="field"><span class="label">Error:</span> ${alert.failedReason}</div>
      <div class="field"><span class="label">Time:</span> ${alert.timestamp.toISOString()}</div>
      <div class="field">
        <span class="label">Payload:</span>
        <pre>${payloadPreview}</pre>
      </div>
      ${
        alert.stacktrace?.length
          ? `<div class="field">
        <span class="label">Stack Trace:</span>
        <pre>${alert.stacktrace.slice(0, 5).join('\n')}</pre>
      </div>`
          : ''
      }
      <div class="footer">
        <p>This alert is throttled to max 1 per 5 minutes per queue.</p>
        <p>Check the dashboard DLQ view to retry or investigate.</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim(),
        text: `DLQ Alert: ${alert.queueName} job ${alert.jobId} failed permanently after ${alert.attemptsMade} attempts. Error: ${alert.failedReason}`,
      });

      this.logger.log(`DLQ email alert sent to ${adminEmail} for queue ${alert.queueName}`);
    } catch (error) {
      this.logger.error(`Failed to send DLQ email alert: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Send Slack webhook alert (optional, configurable)
   */
  private async sendSlackAlert(alert: DlqAlertPayload): Promise<void> {
    const webhookUrl = this.configService.get<string>('DLQ_SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*DLQ Alert* - \`${alert.queueName}\` job failed permanently`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: 'Dead Letter Queue Alert',
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Queue:*\n\`${alert.queueName}\``,
                },
                {
                  type: 'mrkdwn',
                  text: `*Job ID:*\n\`${alert.jobId}\``,
                },
                {
                  type: 'mrkdwn',
                  text: `*Attempts:*\n${alert.attemptsMade}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Time:*\n${alert.timestamp.toISOString()}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Error:*\n\`\`\`${alert.failedReason}\`\`\``,
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      this.logger.log(`DLQ Slack alert sent for queue ${alert.queueName}`);
    } catch (error) {
      this.logger.error(`Failed to send DLQ Slack alert: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Check if alerts for this queue are throttled (Redis-based)
   */
  private async isThrottled(queueName: string): Promise<boolean> {
    try {
      const key = `${this.THROTTLE_KEY_PREFIX}${queueName}`;
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.warn(`Redis throttle check failed: ${getErrorMessage(error)}`);
      return false; // Allow alert if Redis is down
    }
  }

  /**
   * Mark this queue as recently alerted for throttling (Redis TTL)
   */
  private async markThrottled(queueName: string): Promise<void> {
    try {
      const key = `${this.THROTTLE_KEY_PREFIX}${queueName}`;
      await this.redis.set(key, '1', 'EX', this.THROTTLE_SECONDS);
    } catch (error) {
      this.logger.warn(`Redis throttle mark failed: ${getErrorMessage(error)}`);
    }
  }
}

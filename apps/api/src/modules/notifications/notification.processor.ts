import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export interface SendNotificationJobData {
  ticketId: string;
  tenantId: string;
  channel: string;
  eventType: string;
  data: Record<string, any>;
  config: Record<string, any>;
  preferenceId: string;
}

@Processor('send-notification')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<SendNotificationJobData>): Promise<any> {
    const { channel, ticketId, tenantId, eventType, data, config } = job.data;

    this.logger.log(
      `Processing ${channel} notification for event ${eventType} on ticket ${ticketId}`,
    );

    try {
      switch (channel) {
        case 'email':
          await this.sendEmail(ticketId, tenantId, eventType, data, config);
          break;
        case 'webhook':
          await this.sendWebhook(eventType, data, config);
          break;
        case 'slack':
          await this.sendSlack(eventType, data, config);
          break;
        default:
          this.logger.warn(`Unknown notification channel: ${channel}`);
          break;
      }

      // Update the most recent pending log for this ticket+channel+eventType to sent
      await this.updateLogStatus(ticketId, tenantId, channel, eventType, 'sent');

      this.logger.log(
        `Successfully sent ${channel} notification for event ${eventType} on ticket ${ticketId}`,
      );

      return { sent: true, channel };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to send ${channel} notification for ticket ${ticketId}: ${errorMessage}`,
      );

      // Update log status to failed
      await this.updateLogStatus(
        ticketId,
        tenantId,
        channel,
        eventType,
        'failed',
        errorMessage,
      );

      throw error; // triggers BullMQ retry
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SendNotificationJobData>, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  private async sendEmail(
    ticketId: string,
    tenantId: string,
    eventType: string,
    data: Record<string, any>,
    config: Record<string, any>,
  ): Promise<void> {
    const { Resend } = await import('resend');
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set - skipping email notification');
      return;
    }

    const resend = new Resend(apiKey);
    const fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'notifications@support-helper.com';

    // Determine recipients from config or look up ticket reporter
    let recipients: string[] = [];
    if (config.recipients && Array.isArray(config.recipients)) {
      recipients = config.recipients;
    } else if (config.email) {
      recipients = [config.email];
    } else {
      // Fall back to ticket reporter email
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          reporter: { select: { email: true } },
        },
      });
      if (ticket?.reporter?.email) {
        recipients = [ticket.reporter.email];
      }
    }

    if (recipients.length === 0) {
      this.logger.warn(
        `No email recipients found for ticket ${ticketId} event ${eventType}`,
      );
      return;
    }

    const subject = this.buildEmailSubject(eventType, data);
    const html = this.buildEmailHtml(eventType, data);

    const result = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
      tags: [
        { name: 'eventType', value: eventType },
        { name: 'ticketId', value: ticketId },
        { name: 'tenantId', value: tenantId },
      ],
    });

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }

  private async sendWebhook(
    eventType: string,
    data: Record<string, any>,
    config: Record<string, any>,
  ): Promise<void> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('webhookUrl not configured in notification preference');
    }

    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.webhookSecret
          ? { 'X-Webhook-Secret': config.webhookSecret }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook POST to ${webhookUrl} failed with status ${response.status}`,
      );
    }
  }

  private async sendSlack(
    eventType: string,
    data: Record<string, any>,
    config: Record<string, any>,
  ): Promise<void> {
    const slackWebhookUrl = config.slackWebhookUrl;
    if (!slackWebhookUrl) {
      throw new Error(
        'slackWebhookUrl not configured in notification preference',
      );
    }

    const title = data.ticketTitle || data.title || 'Ticket Update';
    const emoji = this.getEventEmoji(eventType);

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${this.formatEventType(eventType)}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Ticket:*\n${title}`,
            },
            {
              type: 'mrkdwn',
              text: `*Event:*\n${eventType}`,
            },
          ],
        },
        ...(data.summary
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Summary:*\n${data.summary}`,
                },
              },
            ]
          : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Ticket ID: ${data.ticketId || 'N/A'} | ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook failed with status ${response.status}`,
      );
    }
  }

  private async updateLogStatus(
    ticketId: string,
    tenantId: string,
    channel: string,
    eventType: string,
    status: string,
    error?: string,
  ): Promise<void> {
    try {
      // Find the most recent pending log matching this notification
      const log = await this.prisma.notificationLog.findFirst({
        where: {
          ticketId,
          tenantId,
          channel,
          eventType,
          status: 'pending',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (log) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: { status, ...(error ? { error } : {}) },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to update notification log status: ${err instanceof Error ? err.message : 'Unknown'}`,
      );
    }
  }

  private buildEmailSubject(
    eventType: string,
    data: Record<string, any>,
  ): string {
    const title = data.ticketTitle || data.title || 'Ticket';
    const eventLabels: Record<string, string> = {
      ticket_received: `New Ticket: ${title}`,
      analysis_completed: `Analysis Complete: ${title}`,
      code_generation_started: `Code Generation Started: ${title}`,
      pr_created: `PR Created: ${title}`,
      pr_merged: `PR Merged: ${title}`,
      fix_deployed: `Fix Deployed: ${title}`,
    };
    return eventLabels[eventType] || `Ticket Update: ${title}`;
  }

  private buildEmailHtml(
    eventType: string,
    data: Record<string, any>,
  ): string {
    const title = data.ticketTitle || data.title || 'Ticket Update';
    const summary = data.summary || data.description || '';
    const emoji = this.getEventEmoji(eventType);
    const eventLabel = this.formatEventType(eventType);

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .event-badge { display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 12px; font-size: 14px; margin-bottom: 12px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${emoji} ${eventLabel}</h2>
    </div>
    <div class="content">
      <h3>${title}</h3>
      <span class="event-badge">${eventType}</span>
      ${summary ? `<p>${summary}</p>` : ''}
      <div class="footer">
        <p>Ticket ID: ${data.ticketId || 'N/A'}</p>
        <p>This is an automated notification from Support Helper.</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }

  private formatEventType(eventType: string): string {
    return eventType
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private getEventEmoji(eventType: string): string {
    const emojis: Record<string, string> = {
      ticket_received: '📩',
      analysis_completed: '🔍',
      code_generation_started: '⚙️',
      pr_created: '🔀',
      pr_merged: '✅',
      fix_deployed: '🚀',
    };
    return emojis[eventType] || '📋';
  }
}

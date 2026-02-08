import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════════
// EMAIL SERVICE (Resend Integration)
// ═══════════════════════════════════════════════════════════════════════

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailTemplate {
  name:
    | 'support_question'
    | 'support_solution'
    | 'escalation_notification'
    | 'resolution_confirmation';
  subject: string;
  html: (data: Record<string, any>) => string;
}

// Email templates for the support agent
const TEMPLATES: Record<string, EmailTemplate> = {
  support_question: {
    name: 'support_question',
    subject: 'Re: {{ticketTitle}} - We need more information',
    html: data =>
      `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .question { background: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 15px 0; border-radius: 4px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
    .btn { display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🤖 AI Support Agent</h2>
    </div>
    <div class="content">
      <p>Hi ${data.userName || 'there'},</p>
      <p>Thank you for reaching out about <strong>${data.ticketTitle}</strong>.</p>
      <p>To help you better, I need some additional information:</p>
      <div class="question">
        ${data.question}
      </div>
      <p>Please reply to this email with your answers, and I'll continue working on your request.</p>
      <a href="${data.replyUrl || '#'}" class="btn">Reply Now</a>
      <div class="footer">
        <p>Ticket ID: ${data.ticketId}</p>
        <p>This is an automated message from our AI support system. If you'd prefer to speak with a human agent, just let us know.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
  },

  support_solution: {
    name: 'support_solution',
    subject: 'Re: {{ticketTitle}} - Suggested Solution',
    html: data =>
      `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .solution { background: white; padding: 15px; border-left: 4px solid #059669; margin: 15px 0; border-radius: 4px; }
    .steps { background: white; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin: 8px 0; }
    .confidence { font-size: 12px; color: #6b7280; margin-top: 10px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
    .btn { display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
    .btn-secondary { background: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">✅ Solution Found</h2>
    </div>
    <div class="content">
      <p>Hi ${data.userName || 'there'},</p>
      <p>I've analyzed your issue and found a solution:</p>
      <div class="solution">
        ${data.solution}
      </div>
      ${
        data.steps && data.steps.length > 0
          ? `
      <div class="steps">
        <strong>Steps to resolve:</strong>
        <ol>
          ${data.steps.map((step: string) => `<li>${step}</li>`).join('')}
        </ol>
      </div>
      `
          : ''
      }
      <p class="confidence">Confidence: ${Math.round((data.confidence || 0) * 100)}%</p>
      <p>Did this help resolve your issue?</p>
      <a href="${data.confirmUrl || '#'}" class="btn">Yes, it's resolved!</a>
      <a href="${data.moreHelpUrl || '#'}" class="btn btn-secondary">I need more help</a>
      <div class="footer">
        <p>Ticket ID: ${data.ticketId}</p>
        <p>If you'd prefer to speak with a human agent, just reply asking for one.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
  },

  escalation_notification: {
    name: 'escalation_notification',
    subject: '[ESCALATED] Ticket requires attention: {{ticketTitle}}',
    html: data =>
      `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #DC2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 4px; border: 1px solid #e5e7eb; }
    .label { font-weight: bold; color: #4b5563; }
    .priority-critical { color: #DC2626; font-weight: bold; }
    .priority-high { color: #F59E0B; font-weight: bold; }
    .btn { display: inline-block; background: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">⚠️ Ticket Escalated</h2>
    </div>
    <div class="content">
      <p>A support ticket has been escalated and requires your attention:</p>
      <div class="info-box">
        <p><span class="label">Ticket:</span> ${data.ticketTitle}</p>
        <p><span class="label">Ticket ID:</span> ${data.ticketId}</p>
        <p><span class="label">Priority:</span> <span class="priority-${data.priority}">${data.priority?.toUpperCase()}</span></p>
        <p><span class="label">Reason:</span> ${data.reason}</p>
        <p><span class="label">Customer:</span> ${data.customerName || 'Unknown'} (${data.customerEmail || 'No email'})</p>
      </div>
      <p><strong>AI Agent Summary:</strong></p>
      <div class="info-box">
        ${data.aiSummary || 'No summary available'}
      </div>
      <a href="${data.ticketUrl || '#'}" class="btn">View Ticket</a>
    </div>
  </div>
</body>
</html>
    `.trim(),
  },

  resolution_confirmation: {
    name: 'resolution_confirmation',
    subject: 'Re: {{ticketTitle}} - Issue Resolved',
    html: data =>
      `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
    .btn { display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🎉 Issue Resolved</h2>
    </div>
    <div class="content">
      <p>Hi ${data.userName || 'there'},</p>
      <p>Great news! Your issue "<strong>${data.ticketTitle}</strong>" has been marked as resolved.</p>
      <p>Thank you for using our support service. If you have any other questions or issues, don't hesitate to reach out.</p>
      <a href="${data.feedbackUrl || '#'}" class="btn">Share Feedback</a>
      <div class="footer">
        <p>Ticket ID: ${data.ticketId}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
  },
};

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private fromEmail: string;
  private enabled: boolean = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'support@example.com';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.enabled = true;
      this.logger.log('EmailService initialized with Resend');
    } else {
      this.logger.warn('RESEND_API_KEY not set - email sending disabled');
    }
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send a raw email
   */
  async send(options: SendEmailOptions): Promise<{ id: string } | null> {
    if (!this.resend) {
      this.logger.warn('Email not sent - Resend not configured');
      this.logger.debug(`Would have sent email to ${options.to}: ${options.subject}`);
      return null;
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
      return { id: result.data?.id || 'unknown' };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a templated email
   */
  async sendTemplate(
    templateName: keyof typeof TEMPLATES,
    to: string,
    data: Record<string, any>
  ): Promise<{ id: string } | null> {
    const template = TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }

    const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
    const html = template.html(data);

    return this.send({
      to,
      subject,
      html,
      tags: [
        { name: 'template', value: templateName },
        { name: 'ticketId', value: data.ticketId || 'unknown' },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS FOR AGENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Send a support question email
   */
  async sendSupportQuestion(
    to: string,
    ticketId: string,
    ticketTitle: string,
    question: string,
    userName?: string,
    replyUrl?: string
  ): Promise<{ id: string } | null> {
    return this.sendTemplate('support_question', to, {
      ticketId,
      ticketTitle,
      question,
      userName,
      replyUrl,
    });
  }

  /**
   * Send a support solution email
   */
  async sendSupportSolution(
    to: string,
    ticketId: string,
    ticketTitle: string,
    solution: string,
    confidence: number,
    steps?: string[],
    userName?: string,
    confirmUrl?: string,
    moreHelpUrl?: string
  ): Promise<{ id: string } | null> {
    return this.sendTemplate('support_solution', to, {
      ticketId,
      ticketTitle,
      solution,
      confidence,
      steps,
      userName,
      confirmUrl,
      moreHelpUrl,
    });
  }

  /**
   * Send escalation notification to support team
   */
  async sendEscalationNotification(
    to: string,
    ticketId: string,
    ticketTitle: string,
    reason: string,
    priority: string,
    customerName?: string,
    customerEmail?: string,
    aiSummary?: string,
    ticketUrl?: string
  ): Promise<{ id: string } | null> {
    return this.sendTemplate('escalation_notification', to, {
      ticketId,
      ticketTitle,
      reason,
      priority,
      customerName,
      customerEmail,
      aiSummary,
      ticketUrl,
    });
  }

  /**
   * Send resolution confirmation to user
   */
  async sendResolutionConfirmation(
    to: string,
    ticketId: string,
    ticketTitle: string,
    userName?: string,
    feedbackUrl?: string
  ): Promise<{ id: string } | null> {
    return this.sendTemplate('resolution_confirmation', to, {
      ticketId,
      ticketTitle,
      userName,
      feedbackUrl,
    });
  }
}

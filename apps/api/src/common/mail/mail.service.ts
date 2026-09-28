import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../services/encryption.service';

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

interface SmtpSettings {
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromEmail: string;
  secure?: boolean;
}

/**
 * Single entry point for outgoing email.
 *
 * Transport resolution order:
 * 1. Resend, when RESEND_API_KEY is set
 * 2. SMTP configured in the setup wizard (system_config.smtp_config)
 * 3. SMTP from environment (SMTP_HOST / SMTP_PORT ..., MailHog in development)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService
  ) {}

  /** Returns false when no transport is configured (email silently skipped). */
  async send(message: MailMessage): Promise<boolean> {
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      await this.sendWithResend(resendKey, message);
      return true;
    }

    const smtp = await this.resolveSmtp();
    if (!smtp) {
      this.logger.warn(`No email transport configured - skipping "${message.subject}"`);
      return false;
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure ?? smtp.port === 465,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });

    try {
      await transport.sendMail({
        from: smtp.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } finally {
      transport.close();
    }
    return true;
  }

  private async sendWithResend(apiKey: string, message: MailMessage): Promise<void> {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const from = this.config.get<string>('RESEND_FROM_EMAIL') || 'notifications@support-helper.com';

    const result = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: message.tags,
    });

    if (result.error) {
      throw new ServiceUnavailableException(`Resend error: ${result.error.message}`);
    }
  }

  private async resolveSmtp(): Promise<SmtpSettings | null> {
    const stored = await this.prisma.systemConfig.findUnique({ where: { key: 'smtp_config' } });
    if (stored?.value) {
      const value = stored.value as unknown as SmtpSettings;
      return {
        ...value,
        password: value.password ? this.decryptPassword(value.password) : undefined,
      };
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;

    return {
      host,
      port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
      username: this.config.get<string>('SMTP_USER') || undefined,
      password: this.config.get<string>('SMTP_PASS') || undefined,
      fromEmail: this.config.get<string>('SMTP_FROM') || 'noreply@support-helper.local',
    };
  }

  /** Passwords saved before encryption was introduced are stored in clear text. */
  private decryptPassword(value: string): string {
    return EncryptionService.isEncrypted(value) ? this.encryption.decrypt(value) : value;
  }
}

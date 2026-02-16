import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import {
  CreateAdminDto,
  ValidateAiKeyDto,
  SmtpConfigDto,
  SaveProgressDto,
} from './dto/setup.dto';
import { AuthResponse } from '../../auth/dto/auth.dto';

export interface SetupProgress {
  currentStep: number;
  completedSteps: string[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromEmail: string;
  secure?: boolean;
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if initial setup has been completed
   */
  async isSetupCompleted(): Promise<boolean> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'setup_completed' },
    });

    if (!config) {
      return false;
    }

    return (config.value as { completed: boolean })?.completed || false;
  }

  /**
   * Get current setup progress
   */
  async getSetupProgress(): Promise<SetupProgress> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'setup_progress' },
    });

    if (!config) {
      return {
        currentStep: 1,
        completedSteps: [],
      };
    }

    const value = config.value as unknown as SetupProgress;
    return value;
  }

  /**
   * Create the first admin user during setup
   * Only works if no users exist yet
   */
  async createAdmin(dto: CreateAdminDto): Promise<AuthResponse> {
    // Check if any users exist
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ConflictException('Admin user already exists. Setup has already been completed.');
    }

    this.logger.log(`Creating first admin user: ${dto.email}`);

    // Use AuthService.register to create tenant + admin user
    const result = await this.authService.register({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      tenantName: dto.organizationName,
    });

    this.logger.log(`Admin user created successfully with tenant: ${result.user.tenantId}`);

    return result;
  }

  /**
   * Validate OpenAI API key by making a test request
   */
  async validateAnthropicKey(dto: ValidateAiKeyDto): Promise<{ valid: boolean; error?: string }> {
    try {
      const openai = new OpenAI({ apiKey: dto.apiKey });

      // Make a simple test request to verify the key works
      await openai.models.list();

      this.logger.log('AI API key validated successfully');

      // Save the key to system config
      await this.prisma.systemConfig.upsert({
        where: { key: 'ai_api_key' },
        create: {
          key: 'ai_api_key',
          value: { apiKey: dto.apiKey },
        },
        update: {
          value: { apiKey: dto.apiKey },
        },
      });

      return { valid: true };
    } catch (error) {
      this.logger.error(`AI API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate API key',
      };
    }
  }

  /**
   * Save SMTP configuration to system config
   */
  async saveSmtpConfig(dto: SmtpConfigDto): Promise<{ success: boolean }> {
    const config: SmtpConfig = {
      host: dto.host,
      port: dto.port,
      username: dto.username,
      password: dto.password,
      fromEmail: dto.fromEmail,
      secure: dto.secure,
    };

    await this.prisma.systemConfig.upsert({
      where: { key: 'smtp_config' },
      create: {
        key: 'smtp_config',
        value: config as any,
      },
      update: {
        value: config as any,
      },
    });

    this.logger.log('SMTP configuration saved successfully');

    return { success: true };
  }

  /**
   * Test SMTP connection by verifying transport connectivity
   */
  async testSmtp(dto: SmtpConfigDto): Promise<{ success: boolean; error?: string }> {
    // Basic validation
    if (!dto.host || !dto.port || !dto.fromEmail) {
      return {
        success: false,
        error: 'Missing required SMTP configuration fields',
      };
    }

    if (dto.port < 1 || dto.port > 65535) {
      return {
        success: false,
        error: 'Invalid SMTP port number',
      };
    }

    const transport = nodemailer.createTransport({
      host: dto.host,
      port: dto.port,
      secure: dto.secure ?? dto.port === 465,
      auth: dto.username
        ? { user: dto.username, pass: dto.password }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    try {
      await transport.verify();
      this.logger.log(`SMTP connection test succeeded for ${dto.host}:${dto.port}`);

      // Optionally send a test email to the fromEmail address
      try {
        await transport.sendMail({
          from: dto.fromEmail,
          to: dto.fromEmail,
          subject: 'Support Helper - SMTP Test',
          text: 'This is a test email from the Support Helper setup wizard. Your SMTP configuration is working correctly.',
        });
        this.logger.log(`SMTP test email sent to ${dto.fromEmail}`);
      } catch (sendError) {
        // Connection works but send failed - still report success for the connection test
        this.logger.warn(
          `SMTP connection verified but test email failed: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`,
        );
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMTP test failed';
      const code = (error as NodeJS.ErrnoException).code;
      this.logger.error(`SMTP connection test failed: ${message}`);

      return {
        success: false,
        error: this.mapSmtpError(code, message),
      };
    } finally {
      transport.close();
    }
  }

  private mapSmtpError(code: string | undefined, message: string): string {
    if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
      return 'Connection timed out. Verify the SMTP host and port are correct and reachable.';
    }
    if (code === 'ECONNREFUSED') {
      return 'Connection refused. The SMTP server is not accepting connections on this host/port.';
    }
    if (code === 'ENOTFOUND') {
      return `Hostname not found. Verify that "${message.split("'")[1] || 'the host'}" is correct.`;
    }
    if (code === 'EAUTH' || message.includes('Invalid login') || message.includes('Authentication')) {
      return 'Authentication failed. Check your SMTP username and password.';
    }
    if (message.includes('self-signed') || message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || message.includes('certificate')) {
      return 'TLS certificate error. The server certificate could not be verified. Check the secure/TLS settings.';
    }
    if (code === 'ECONNRESET') {
      return 'Connection was reset by the server. This may indicate a TLS/SSL mismatch - try toggling the secure setting.';
    }
    return message;
  }

  /**
   * Save wizard progress
   */
  async saveSetupProgress(dto: SaveProgressDto): Promise<void> {
    const progress: SetupProgress = {
      currentStep: dto.currentStep,
      completedSteps: dto.completedSteps,
    };

    await this.prisma.systemConfig.upsert({
      where: { key: 'setup_progress' },
      create: {
        key: 'setup_progress',
        value: progress as any,
      },
      update: {
        value: progress as any,
      },
    });

    this.logger.log(`Setup progress saved: step ${dto.currentStep}`);
  }

  /**
   * Mark setup as completed
   * Only works if an admin user exists
   */
  async completeSetup(): Promise<{ success: boolean }> {
    // Verify that at least one user exists
    const userCount = await this.prisma.user.count();
    if (userCount === 0) {
      throw new BadRequestException('Cannot complete setup: no admin user has been created');
    }

    await this.prisma.systemConfig.upsert({
      where: { key: 'setup_completed' },
      create: {
        key: 'setup_completed',
        value: { completed: true },
      },
      update: {
        value: { completed: true },
      },
    });

    this.logger.log('Setup marked as completed');

    return { success: true };
  }
}

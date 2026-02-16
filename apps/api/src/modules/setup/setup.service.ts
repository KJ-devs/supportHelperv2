import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
   * Test SMTP connection
   * Currently validates format only - can be extended with actual SMTP connection test
   */
  async testSmtp(dto: SmtpConfigDto): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic validation
      if (!dto.host || !dto.port || !dto.fromEmail) {
        return {
          success: false,
          error: 'Missing required SMTP configuration fields',
        };
      }

      // Validate port range
      if (dto.port < 1 || dto.port > 65535) {
        return {
          success: false,
          error: 'Invalid SMTP port number',
        };
      }

      // TODO: Add actual SMTP connection test using nodemailer
      // For now, just validate the configuration format

      this.logger.log('SMTP configuration validated (format check only)');

      return { success: true };
    } catch (error) {
      this.logger.error(`SMTP test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP test failed',
      };
    }
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

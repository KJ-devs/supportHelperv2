import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SetupService, SetupProgress } from './setup.service';
import { Public } from '../../auth/decorators/public.decorator';
import {
  CreateAdminDto,
  ValidateAiKeyDto,
  SmtpConfigDto,
  SaveProgressDto,
} from './dto/setup.dto';

@ApiTags('Setup')
@Controller('setup')
@Public()
@Throttle({ public: { limit: 10, ttl: 60000 } })
export class SetupController {
  private readonly logger = new Logger(SetupController.name);

  constructor(private readonly setupService: SetupService) {}

  /**
   * GET /setup/status
   * Check setup completion status and current progress
   */
  @Get('status')
  @ApiOperation({ summary: 'Get setup status and progress' })
  @ApiResponse({
    status: 200,
    description: 'Setup status retrieved successfully',
    schema: {
      example: {
        setupCompleted: false,
        progress: {
          currentStep: 2,
          completedSteps: ['admin', 'ai-key'],
        },
      },
    },
  })
  async getStatus(): Promise<{ setupCompleted: boolean; progress: SetupProgress }> {
    const [setupCompleted, progress] = await Promise.all([
      this.setupService.isSetupCompleted(),
      this.setupService.getSetupProgress(),
    ]);

    return {
      setupCompleted,
      progress,
    };
  }

  /**
   * POST /setup/admin
   * Create the first admin user
   */
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create first admin user during setup' })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
    schema: {
      example: {
        user: {
          id: 'uuid',
          tenantId: 'uuid',
          email: 'admin@example.com',
          name: 'John Doe',
          role: 'owner',
          createdAt: '2026-02-16T12:00:00.000Z',
        },
        accessToken: 'jwt-token',
        refreshToken: 'jwt-refresh-token',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Admin user already exists',
  })
  async createAdmin(@Body() dto: CreateAdminDto) {
    this.logger.log(`Setup: Creating admin user ${dto.email}`);
    return this.setupService.createAdmin(dto);
  }

  /**
   * POST /setup/validate-ai-key
   * Test and save AI API key
   */
  @Post('validate-ai-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and save AI API key' })
  @ApiResponse({
    status: 200,
    description: 'AI API key validation result',
    schema: {
      example: {
        valid: true,
      },
    },
  })
  async validateAiKey(@Body() dto: ValidateAiKeyDto) {
    this.logger.log('Setup: Validating AI API key');
    return this.setupService.validateAnthropicKey(dto);
  }

  /**
   * POST /setup/smtp
   * Save SMTP configuration
   */
  @Post('smtp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save SMTP configuration' })
  @ApiResponse({
    status: 200,
    description: 'SMTP configuration saved successfully',
    schema: {
      example: {
        success: true,
      },
    },
  })
  async saveSmtpConfig(@Body() dto: SmtpConfigDto) {
    this.logger.log('Setup: Saving SMTP configuration');
    return this.setupService.saveSmtpConfig(dto);
  }

  /**
   * POST /setup/smtp-test
   * Test SMTP connection
   */
  @Post('smtp-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test SMTP connection' })
  @ApiResponse({
    status: 200,
    description: 'SMTP test result',
    schema: {
      example: {
        success: true,
      },
    },
  })
  async testSmtp(@Body() dto: SmtpConfigDto) {
    this.logger.log('Setup: Testing SMTP configuration');
    return this.setupService.testSmtp(dto);
  }

  /**
   * POST /setup/progress
   * Save wizard progress
   */
  @Post('progress')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save setup wizard progress' })
  @ApiResponse({
    status: 200,
    description: 'Progress saved successfully',
    schema: {
      example: {
        success: true,
      },
    },
  })
  async saveProgress(@Body() dto: SaveProgressDto) {
    this.logger.log(`Setup: Saving progress - step ${dto.currentStep}`);
    await this.setupService.saveSetupProgress(dto);
    return { success: true };
  }

  /**
   * POST /setup/complete
   * Mark setup as completed
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark setup as completed' })
  @ApiResponse({
    status: 200,
    description: 'Setup completed successfully',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot complete setup - admin user not created',
  })
  async completeSetup() {
    this.logger.log('Setup: Marking setup as completed');
    return this.setupService.completeSetup();
  }
}

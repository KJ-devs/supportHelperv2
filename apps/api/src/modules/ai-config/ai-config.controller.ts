import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AiConfigService } from './ai-config.service';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';
import { ValidateKeyDto } from './dto/validate-key.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { QuotaService } from './quota.service';

@ApiTags('AI Configuration')
@ApiBearerAuth()
@Controller('settings/ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(
    private readonly aiConfigService: AiConfigService,
    private readonly quotaService: QuotaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current AI configuration (masked key)' })
  @ApiResponse({ status: 200, description: 'AI configuration retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.aiConfigService.getConfig(tenantId);
    if (!config) {
      return {
        configured: false,
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        maskedApiKey: null,
        settings: {},
      };
    }
    return { configured: true, ...config };
  }

  @Patch()
  @ApiOperation({ summary: 'Update AI configuration (key, model, settings)' })
  @ApiResponse({ status: 200, description: 'AI configuration updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateAiConfigDto,
  ) {
    const config = await this.aiConfigService.upsertConfig(tenantId, dto);
    return { configured: true, ...config };
  }

  @Post('validate-key')
  @ApiOperation({ summary: 'Validate an Anthropic API key' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: {
      properties: {
        valid: { type: 'boolean' },
        error: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateKey(@Body() dto: ValidateKeyDto) {
    return this.aiConfigService.validateKey(
      dto.apiKey ?? '',
      dto.provider,
      dto.endpoint,
      dto.model,
    );
  }

  // ─── Quota Endpoints ───────────────────────────────────────────────────────

  @Get('quota')
  @ApiOperation({ summary: 'Get AI quota status for current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Quota status retrieved',
    schema: {
      properties: {
        plan: { type: 'string' },
        monthlyQuota: { type: 'number' },
        currentUsage: { type: 'number' },
        remaining: { type: 'number', description: '-1 means unlimited (BYOK)' },
        isByok: { type: 'boolean' },
        resetsAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getQuota(@CurrentTenant() tenantId: string) {
    return this.quotaService.getQuotaStatus(tenantId);
  }

  @Patch('quota')
  @ApiOperation({
    summary: 'Update quota settings for current tenant (admin use)',
  })
  @ApiResponse({ status: 200, description: 'Quota updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateQuota(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateQuotaDto,
  ) {
    return this.quotaService.updateQuota(tenantId, dto);
  }
}

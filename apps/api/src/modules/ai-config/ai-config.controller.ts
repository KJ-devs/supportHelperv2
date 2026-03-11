import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AiConfigService } from './ai-config.service';
import { AiPromptConfigService } from './ai-prompt-config.service';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';
import { UpdateAiPromptConfigDto } from './dto/update-ai-prompt-config.dto';
import { ValidateKeyDto } from './dto/validate-key.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { QuotaService } from './quota.service';
import { AiUsageService } from './ai-usage.service';
import { AiCircuitBreakerService } from '../../ai/circuit-breaker.service';

@ApiTags('AI Configuration')
@ApiBearerAuth()
@Controller('settings/ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(
    private readonly aiConfigService: AiConfigService,
    private readonly aiPromptConfigService: AiPromptConfigService,
    private readonly quotaService: QuotaService,
    private readonly aiUsageService: AiUsageService,
    private readonly circuitBreakerService: AiCircuitBreakerService
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
        endpoint: null,
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
  async updateConfig(@CurrentTenant() tenantId: string, @Body() dto: UpdateAiConfigDto) {
    const config = await this.aiConfigService.upsertConfig(tenantId, dto);
    return { configured: true, ...config };
  }

  @Post('validate-key')
  @ApiOperation({ summary: 'Validate an AI provider API key/configuration' })
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
      dto.model
    );
  }

  // ─── AI Prompt Configuration Endpoints ───────────────────────────────────────

  @Get('prompts')
  @ApiOperation({ summary: 'Get AI prompt/behavior configuration for current tenant' })
  @ApiResponse({ status: 200, description: 'AI prompt configuration retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPromptConfig(@CurrentTenant() tenantId: string) {
    const config = await this.aiPromptConfigService.getConfig(tenantId);
    if (!config) {
      return {
        configured: false,
        productDescription: null,
        globalInstructions: null,
        triageInstructions: null,
        analysisInstructions: null,
        responseLanguage: null,
      };
    }
    const hasContent = !!(
      config.productDescription ||
      config.globalInstructions ||
      config.triageInstructions ||
      config.analysisInstructions ||
      config.responseLanguage
    );
    return { configured: hasContent, ...config };
  }

  @Patch('prompts')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update AI prompt/behavior configuration (admin only)' })
  @ApiResponse({ status: 200, description: 'AI prompt configuration updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires admin role' })
  async updatePromptConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateAiPromptConfigDto
  ) {
    const config = await this.aiPromptConfigService.upsertConfig(tenantId, dto);
    const hasContent = !!(
      config.productDescription ||
      config.globalInstructions ||
      config.triageInstructions ||
      config.analysisInstructions ||
      config.responseLanguage
    );
    return { configured: hasContent, ...config };
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
  async updateQuota(@CurrentTenant() tenantId: string, @Body() dto: UpdateQuotaDto) {
    return this.quotaService.updateQuota(tenantId, dto);
  }

  // ─── Usage Endpoints ───────────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Get AI usage stats for the last 30 days' })
  @ApiResponse({
    status: 200,
    description: 'AI usage statistics retrieved',
    schema: {
      properties: {
        totalCost: { type: 'number' },
        totalTokens: { type: 'number' },
        totalRequests: { type: 'number' },
        costPerTicket: { type: 'number' },
        period: { type: 'number' },
        byDay: {
          type: 'array',
          items: {
            properties: {
              date: { type: 'string' },
              cost: { type: 'number' },
              tokens: { type: 'number' },
              requests: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsage(@CurrentTenant() tenantId: string) {
    return this.aiUsageService.getUsage(tenantId, 30);
  }

  // ─── Circuit Breaker Endpoints ────────────────────────────────────────────

  @Get('budget-status')
  @ApiOperation({ summary: 'Get daily AI budget status for current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Budget status retrieved',
    schema: {
      properties: {
        dailySpending: { type: 'number', description: 'Current daily spending in USD' },
        dailyLimit: {
          type: 'number',
          nullable: true,
          description: 'Daily limit in USD, null = unlimited',
        },
        percentUsed: {
          type: 'number',
          description: 'Percentage of daily budget used (0 when unlimited)',
        },
        isBlocked: { type: 'boolean', description: 'Whether AI calls are currently blocked' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBudgetStatus(@CurrentTenant() tenantId: string) {
    const spending = await this.circuitBreakerService.getDailySpending(tenantId);
    const limit = await this.circuitBreakerService.getBudgetLimit(tenantId);
    return {
      dailySpending: spending,
      dailyLimit: limit,
      percentUsed: limit ? Math.round((spending / limit) * 100) : 0,
      isBlocked: limit !== null ? spending >= limit : false,
    };
  }

  @Post('reset-circuit')
  @ApiOperation({ summary: 'Reset the AI circuit breaker for current tenant (admin action)' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker reset successfully',
    schema: {
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetCircuit(@CurrentTenant() tenantId: string) {
    await this.circuitBreakerService.resetCircuit(tenantId);
    return { status: 'reset', message: 'Circuit breaker has been reset.' };
  }
}

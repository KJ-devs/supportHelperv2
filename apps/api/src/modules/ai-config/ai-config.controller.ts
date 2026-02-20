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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('AI Configuration')
@ApiBearerAuth()
@Controller('settings/ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

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
  async updateConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateAiConfigDto,
  ) {
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
      dto.apiKey,
      dto.provider,
      dto.endpoint,
      dto.model,
    );
  }
}

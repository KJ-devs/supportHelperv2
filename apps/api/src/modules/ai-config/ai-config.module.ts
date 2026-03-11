import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AiPromptConfigService } from './ai-prompt-config.service';
import { AnthropicClientFactory } from './anthropic-client.factory';
import { ToolCapableProviderFactory } from './tool-capable-provider.factory';
import { AIProviderFactory } from '../../ai/providers/ai-provider.factory';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './quota.guard';
import { AiUsageService } from './ai-usage.service';
import { AIModule } from '../../ai/ai.module';

@Module({
  imports: [PrismaModule, AIModule],
  controllers: [AiConfigController],
  providers: [
    AiConfigService,
    AiPromptConfigService,
    AnthropicClientFactory,
    ToolCapableProviderFactory,
    AIProviderFactory,
    QuotaService,
    QuotaGuard,
    AiUsageService,
  ],
  exports: [
    AiConfigService,
    AiPromptConfigService,
    AnthropicClientFactory,
    ToolCapableProviderFactory,
    QuotaService,
    QuotaGuard,
    AiUsageService,
  ],
})
export class AiConfigModule {}

import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AiConfigService } from './ai-config.service';
import { AnthropicClientFactory } from './anthropic-client.factory';
import { ToolCapableProviderFactory } from './tool-capable-provider.factory';
import { AIProviderFactory } from '../../ai/providers/ai-provider.factory';
import { PrismaModule } from '../../prisma/prisma.module';
import { QuotaService } from './quota.service';
import { QuotaGuard } from './quota.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AiConfigController],
  providers: [
    AiConfigService,
    AnthropicClientFactory,
    ToolCapableProviderFactory,
    AIProviderFactory,
    QuotaService,
    QuotaGuard,
  ],
  exports: [
    AiConfigService,
    AnthropicClientFactory,
    ToolCapableProviderFactory,
    QuotaService,
    QuotaGuard,
  ],
})
export class AiConfigModule {}

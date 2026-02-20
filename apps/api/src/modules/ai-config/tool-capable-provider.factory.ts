import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import { AnthropicProvider } from '../../ai/providers/anthropic.provider';
import { OpenAIProvider } from '../../ai/providers/openai.provider';
import { ToolCapableProvider } from '../../ai/providers/tool-capable-provider.interface';

@Injectable()
export class ToolCapableProviderFactory {
  private readonly logger = new Logger(ToolCapableProviderFactory.name);

  constructor(private readonly aiConfigService: AiConfigService) {}

  async createForTenant(tenantId: string): Promise<ToolCapableProvider> {
    const config = await this.aiConfigService.getFullConfig(tenantId);

    if (!config) {
      throw new ServiceUnavailableException(
        'No AI provider configured for this tenant. Set up an AI provider in Settings.',
      );
    }

    this.logger.debug(
      `Creating tool-capable provider for tenant ${tenantId}: ${config.provider}/${config.model}`,
    );

    switch (config.provider) {
      case 'anthropic':
        return new AnthropicProvider({
          provider: 'anthropic',
          apiKey: config.apiKey,
          model: config.model,
          endpoint: config.endpoint,
        });

      case 'openai':
        return new OpenAIProvider({
          provider: 'openai',
          apiKey: config.apiKey,
          model: config.model,
          endpoint: config.endpoint,
        });

      case 'ollama':
        throw new ServiceUnavailableException(
          'Ollama does not support reliable tool calling and cannot be used for the agentic loop.',
        );

      default:
        throw new ServiceUnavailableException(
          `Unsupported AI provider for agentic loop: ${config.provider}`,
        );
    }
  }
}

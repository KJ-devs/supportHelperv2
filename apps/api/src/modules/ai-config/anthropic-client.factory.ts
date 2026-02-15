import { Injectable, Logger } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicClientFactory {
  private readonly logger = new Logger(AnthropicClientFactory.name);

  constructor(private readonly aiConfigService: AiConfigService) {}

  async createForTenant(tenantId: string): Promise<Anthropic | null> {
    const apiKey = await this.aiConfigService.getDecryptedApiKey(tenantId);

    if (!apiKey) {
      this.logger.warn(
        `No Anthropic API key configured for tenant ${tenantId}`,
      );
      return null;
    }

    return new Anthropic({ apiKey });
  }
}

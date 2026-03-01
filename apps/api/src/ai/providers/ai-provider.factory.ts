import { Injectable, BadRequestException } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import { AIProviderConfig } from './ai-provider.types';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OllamaProvider } from './ollama.provider';
import { GeminiProvider } from './gemini.provider';
import { BedrockProvider } from './bedrock.provider';

@Injectable()
export class AIProviderFactory {
  create(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new BadRequestException('OpenAI API key is required');
        }
        return new OpenAIProvider(config);

      case 'anthropic':
        if (!config.apiKey) {
          throw new BadRequestException('Anthropic API key is required');
        }
        return new AnthropicProvider(config);

      case 'ollama':
        // Ollama doesn't require API key
        return new OllamaProvider(config);

      case 'gemini':
        if (!config.apiKey) {
          throw new BadRequestException('Google AI (Gemini) API key is required');
        }
        return new GeminiProvider(config.apiKey);

      case 'bedrock':
        // Bedrock uses IAM credentials or env-level AWS credentials; no API key required
        return new BedrockProvider({
          region: config.endpoint ?? 'us-east-1',
          model: config.model,
          openaiApiKey: config.apiKey,
        });

      default:
        throw new BadRequestException(
          `Unsupported AI provider: ${config.provider}`,
        );
    }
  }
}

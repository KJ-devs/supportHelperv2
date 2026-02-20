import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, CompletionOptions } from './ai-provider.interface';
import { AIProviderConfig } from './ai-provider.types';

@Injectable()
export class AnthropicProvider implements AIProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: Anthropic;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: options?.model || this.config.model || 'claude-sonnet-4-6',
        max_tokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return '';
    } catch (error) {
      this.logger.error(
        `Anthropic completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    options?: CompletionOptions,
  ): Promise<T> {
    try {
      const systemPrompt =
        options?.systemPrompt ||
        'You are a helpful assistant that responds with valid JSON only.';

      const response = await this.client.messages.create({
        model: options?.model || this.config.model || 'claude-sonnet-4-6',
        max_tokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new ServiceUnavailableException('Expected text response from Anthropic');
      }

      // Extract JSON from response (in case it's wrapped in markdown)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ServiceUnavailableException('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error(
        `Anthropic structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  // Anthropic doesn't provide embeddings API
  generateEmbedding?(text: string): Promise<number[]> {
    this.logger.warn('Anthropic does not support embeddings');
    return Promise.resolve([]);
  }

  getProviderName(): string {
    return 'anthropic';
  }

  async validateConfig(): Promise<boolean> {
    // Use Haiku for validation — cheapest, always available, throw to expose real error
    await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    });
    return true;
  }
}

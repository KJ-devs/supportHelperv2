import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AIProvider, CompletionOptions } from './ai-provider.interface';
import { AIProviderConfig } from './ai-provider.types';

@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organizationId,
    });
  }

  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || this.config.model || 'gpt-4o',
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system' as const, content: options.systemPrompt }]
            : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1500,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      this.logger.error(
        `OpenAI completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      const response = await this.client.chat.completions.create({
        model: options?.model || this.config.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${prompt}\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}`,
          },
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Extract JSON from response (in case it's wrapped)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error(
        `OpenAI structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const EMBEDDING_MAX_CHARS = 32000;
      const truncated =
        text.length > EMBEDDING_MAX_CHARS
          ? text.slice(0, EMBEDDING_MAX_CHARS)
          : text;

      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: truncated,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `OpenAI embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  getProviderName(): string {
    return 'openai';
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logger.warn(
        `OpenAI config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}

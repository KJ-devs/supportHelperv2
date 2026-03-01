import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  Part,
} from '@google/generative-ai';
import OpenAI from 'openai';
import { AIProvider, CompletionOptions } from './ai-provider.interface';
import { withRetry } from './ai-retry.util';

export interface GeminiImageInput {
  data: string;
  mimeType: string;
}

export interface GeminiCompletionOptions extends CompletionOptions {
  images?: GeminiImageInput[];
}

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenerativeAI;
  private readonly openaiClient: OpenAI | null;
  private readonly defaultModel = 'gemini-2.0-flash';

  constructor(apiKey: string, openaiApiKey?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.openaiClient = openaiApiKey
      ? new OpenAI({ apiKey: openaiApiKey })
      : null;
  }

  async generateCompletion(
    prompt: string,
    options?: GeminiCompletionOptions,
  ): Promise<string> {
    try {
      const model: GenerativeModel = this.client.getGenerativeModel({
        model: options?.model || this.defaultModel,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 1500,
        },
        ...(options?.systemPrompt
          ? { systemInstruction: options.systemPrompt }
          : {}),
      });

      const parts: Part[] = [{ text: prompt }];

      if (options?.images && options.images.length > 0) {
        for (const image of options.images) {
          parts.push({
            inlineData: {
              data: image.data,
              mimeType: image.mimeType,
            },
          });
        }
      }

      const response = await withRetry(
        () => model.generateContent(parts),
        { label: 'Gemini.generateCompletion' },
      );

      return response.response.text();
    } catch (error) {
      this.logger.error(
        `Gemini completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: Record<string, unknown>,
    options?: GeminiCompletionOptions,
  ): Promise<T> {
    try {
      const systemPrompt =
        options?.systemPrompt ||
        'You are a helpful assistant that responds with valid JSON only.';

      const model: GenerativeModel = this.client.getGenerativeModel({
        model: options?.model || this.defaultModel,
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 1500,
          responseMimeType: 'application/json',
        },
        systemInstruction: systemPrompt,
      });

      const userText = `${prompt}\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}`;

      const parts: Part[] = [{ text: userText }];

      if (options?.images && options.images.length > 0) {
        for (const image of options.images) {
          parts.push({
            inlineData: {
              data: image.data,
              mimeType: image.mimeType,
            },
          });
        }
      }

      const response = await withRetry(
        () => model.generateContent(parts),
        { label: 'Gemini.generateStructuredOutput' },
      );

      const content = response.response.text();

      if (!content) {
        throw new ServiceUnavailableException('Empty response from Gemini');
      }

      // Extract JSON from response (in case it's wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ServiceUnavailableException('No JSON found in Gemini response');
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      this.logger.error(
        `Gemini structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      this.logger.warn(
        'No OpenAI client available for embeddings — Gemini embeddings (768d) are incompatible with pgvector (1536d). Provide an OpenAI API key.',
      );
      return [];
    }

    try {
      const EMBEDDING_MAX_CHARS = 32000;
      const truncated =
        text.length > EMBEDDING_MAX_CHARS
          ? text.slice(0, EMBEDDING_MAX_CHARS)
          : text;

      const response = await withRetry(
        () =>
          this.openaiClient!.embeddings.create({
            model: 'text-embedding-3-small',
            input: truncated,
          }),
        { label: 'Gemini.generateEmbedding(via OpenAI)' },
      );

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  getProviderName(): string {
    return 'gemini';
  }

  async validateConfig(): Promise<boolean> {
    try {
      await withRetry(
        async () => {
          const model = this.client.getGenerativeModel({ model: this.defaultModel });
          await model.generateContent('ping');
        },
        { label: 'Gemini.validateConfig' },
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Gemini config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, CompletionOptions } from './ai-provider.interface';
import { AIProviderConfig } from './ai-provider.types';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
  system?: string;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
  format?: 'json';
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

@Injectable()
export class OllamaProvider implements AIProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private endpoint: string;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.endpoint = config.endpoint || 'http://localhost:11434';
  }

  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
  ): Promise<string> {
    try {
      const requestBody: OllamaChatRequest = {
        model: options?.model || this.config.model || 'llama3.1',
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system', content: options.systemPrompt }]
            : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 1500,
        },
      };

      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      return data.message.content;
    } catch (error) {
      this.logger.error(
        `Ollama completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      const requestBody: OllamaChatRequest = {
        model: options?.model || this.config.model || 'llama3.1',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${prompt}\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}`,
          },
        ],
        stream: false,
        format: 'json',
        options: {
          temperature: options?.temperature ?? 0.3,
          num_predict: options?.maxTokens ?? 1500,
        },
      };

      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      const content = data.message.content;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error(
        `Ollama structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const requestBody: OllamaEmbeddingRequest = {
        model: this.config.model || 'llama3.1',
        prompt: text,
      };

      const response = await fetch(`${this.endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;
      return data.embedding;
    } catch (error) {
      this.logger.error(
        `Ollama embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  getProviderName(): string {
    return 'ollama';
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test connection by listing models
      const response = await fetch(`${this.endpoint}/api/tags`);
      return response.ok;
    } catch (error) {
      this.logger.warn(
        `Ollama config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}

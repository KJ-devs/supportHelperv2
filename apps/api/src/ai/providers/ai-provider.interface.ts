export interface AIProvider {
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  generateStructuredOutput<T>(prompt: string, schema: any, options?: CompletionOptions): Promise<T>;
  generateEmbedding?(text: string): Promise<number[]>;
  getProviderName(): string;
  validateConfig(): Promise<boolean>;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export type AIProviderType = 'openai' | 'anthropic' | 'ollama';

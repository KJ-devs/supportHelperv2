import { AIProviderType } from './ai-provider.interface';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  organizationId?: string;
}

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  ollama: 'llama3.1',
};

export const PROVIDER_LABELS: Record<AIProviderType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (Local)',
};

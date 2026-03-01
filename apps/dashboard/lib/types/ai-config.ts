/**
 * AI Configuration Types
 */

export type AIProviderType = 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'bedrock';

export interface AiConfigResponse {
  configured: boolean;
  id?: string;
  tenantId?: string;
  provider: AIProviderType;
  maskedApiKey: string | null;
  model: string;
  endpoint?: string;
  settings: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIConfigUpdate {
  provider?: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  settings?: Record<string, any>;
}

export interface ValidateKeyResponse {
  valid: boolean;
  error?: string;
}

export interface TestConnectionPayload {
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

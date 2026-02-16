/**
 * AI Configuration Types
 */

export type AIProviderType = 'openai' | 'anthropic' | 'ollama';

export interface AiConfigResponse {
  configured: boolean;
  id?: string;
  tenantId?: string;
  provider: AIProviderType;
  maskedApiKey: string | null;
  model: string;
  settings: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIConfigUpdate {
  provider?: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  organizationId?: string;
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
  organizationId?: string;
}

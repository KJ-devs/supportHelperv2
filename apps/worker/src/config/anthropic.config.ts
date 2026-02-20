import { registerAs } from '@nestjs/config';

/**
 * Anthropic Configuration
 *
 * Primary AI provider for completions and vision analysis.
 * OpenAI is retained only for embeddings (text-embedding-3-large).
 */
export default registerAs('anthropic', () => ({
  apiKey: process.env.ANTHROPIC_API_KEY,

  // Models
  models: {
    vision: 'claude-sonnet-4-6',
    chat: 'claude-sonnet-4-6',
    chatFast: 'claude-haiku-4-5-20251001',
  },

  // Vision API settings
  vision: {
    maxTokens: 4096,
    temperature: 0.3,
    batchSize: 10,
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 50,
    tokensPerMinute: 150000,
  },

  // Retry configuration
  retry: {
    attempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
  },

  // Cost tracking (per 1M tokens, stored as per-1K for backward compat)
  costs: {
    'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
  },
}));

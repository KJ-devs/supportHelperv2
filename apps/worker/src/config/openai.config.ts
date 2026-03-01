import { registerAs } from '@nestjs/config';

/**
 * OpenAI Configuration
 */
export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,

  // Models
  models: {
    vision: 'gpt-4o', // GPT-4 Turbo with Vision
    chat: 'gpt-4o',
    chatFast: 'gpt-4o-mini', // For fast classification
    embedding: 'text-embedding-3-small',
  },

  // Vision API settings
  vision: {
    maxTokens: 4096,
    temperature: 0.3, // Lower for consistent analysis
    batchSize: 10, // Process 10 frames at a time
  },

  // Embedding settings (text-embedding-3-small — unified across all services)
  embedding: {
    dimensions: 1536,
    batchSize: 100,
    cacheTtl: 86400, // 24 hours in seconds
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 50, // Conservative limit
    tokensPerMinute: 150000,
  },

  // Retry configuration
  retry: {
    attempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
  },

  // Cost tracking (per 1K tokens)
  costs: {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
  },
}));

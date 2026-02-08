import { registerAs } from '@nestjs/config';

/**
 * OpenAI configuration
 */
export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  enabled: !!process.env.OPENAI_API_KEY,
}));

import { registerAs } from '@nestjs/config';

/**
 * Database configuration
 */
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
}));

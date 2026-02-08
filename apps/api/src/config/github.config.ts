import { registerAs } from '@nestjs/config';

/**
 * GitHub OAuth configuration
 */
export default registerAs('github', () => ({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  enabled: !!(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  ),
}));

import { registerAs } from '@nestjs/config';

/**
 * GitHub OAuth & App configuration
 */
export default registerAs('github', () => ({
  // OAuth (legacy user-token flow)
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  enabled: !!(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  ),

  // GitHub App (installation-based flow)
  appId: process.env.GITHUB_APP_ID,
  // PEM private key - handle escaped newlines from env vars
  privateKey: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  appName: process.env.GITHUB_APP_NAME,
  appEnabled: !!(
    process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY
  ),
}));

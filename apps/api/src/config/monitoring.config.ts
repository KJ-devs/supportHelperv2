import { registerAs } from '@nestjs/config';

export default registerAs('monitoring', () => ({
  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN,
    enabled: !!process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  },

  // Better Stack (Logtail)
  betterStack: {
    sourceToken: process.env.BETTERSTACK_SOURCE_TOKEN,
    enabled: !!process.env.BETTERSTACK_SOURCE_TOKEN,
    endpoint: process.env.BETTERSTACK_ENDPOINT || 'https://in.logs.betterstack.com',
  },

  // PostHog
  posthog: {
    apiKey: process.env.POSTHOG_API_KEY,
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    enabled: !!process.env.POSTHOG_API_KEY,
  },

  // Uptime monitoring
  uptime: {
    enabled: process.env.UPTIME_MONITORING_ENABLED === 'true',
    webhookUrl: process.env.UPTIME_WEBHOOK_URL,
  },
}));

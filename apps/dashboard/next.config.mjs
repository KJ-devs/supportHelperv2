import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@support-helper/shared'],

  // Experimental features
  experimental: {
    instrumentationHook: true,
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Ignore specific warnings
    config.ignoreWarnings = [
      { module: /node_modules\/@opentelemetry/ },
    ];

    return config;
  },
};

// Sentry webpack plugin configuration
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in production
  silent: process.env.NODE_ENV !== 'production',

  // Hide source maps from browser
  hideSourceMaps: true,

  // Disable webpack plugins when no auth token
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,

  // Automatically add release info
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Disable telemetry
  telemetry: false,

  // Tree shake Sentry logger statements
  disableLogger: true,

  // Automatically instrument API routes
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
};

// Only wrap with Sentry in production or when explicitly enabled
const config =
  process.env.NODE_ENV === 'production' || process.env.SENTRY_AUTH_TOKEN
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig;

export default config;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable Turbopack for development
  experimental: {
    // Disabled for now - causes build issues with dynamic routes
    // typedRoutes: true,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },

  // Transpile workspace packages
  transpilePackages: ['@support-helper/shared'],

  // Redirects
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for Web App
 *
 * Run with: npx playwright test
 * UI Mode: npx playwright test --ui
 *
 * Note: E2E tests require the full infrastructure to be running.
 * Run `pnpm docker:up` first to start the required services.
 */

// Check if E2E environment is ready (requires API to be configured)
const isE2EReady = !!(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

// Log skip message if environment isn't ready
if (!isE2EReady) {
  console.log('E2E tests skipped: Required environment variables not set.');
  console.log('Run `pnpm docker:up` first to start the required services.');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  // Include skip test file when environment isn't ready to avoid "no tests" error
  testMatch: isE2EReady ? '**/pages/**/*.spec.ts' : '**/e2e-skip.spec.ts',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(isE2EReady
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
          {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
          },
          {
            name: 'mobile-safari',
            use: { ...devices['iPhone 12'] },
          },
        ]
      : []),
  ],

  // Only configure webServer if environment is ready
  ...(isE2EReady
    ? {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }
    : {}),
});

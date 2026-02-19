import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E Configuration for API Integration Tests
 *
 * These tests use Playwright's `request` API context (no browser needed).
 * External provider APIs (Jira, Slack, HubSpot, Notion, Discord) are mocked
 * via a local mock server spun up in globalSetup.
 *
 * Run with: pnpm --filter @support-helper/api test:e2e:playwright
 */

const isE2EReady = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

export default defineConfig({
  testDir: './test/e2e/integrations',
  testMatch: '**/*.e2e-spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test/e2e/playwright-report' }]],
  timeout: 30_000,

  use: {
    baseURL: process.env.TEST_API_URL || 'http://localhost:3001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
});

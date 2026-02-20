import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/demo',
  testMatch: '**/*.demo.ts',
  timeout: 5 * 60 * 1000, // 5 minutes
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    viewport: { width: 1440, height: 900 },
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    screenshot: 'on',
    trace: 'on',
    launchOptions: {
      slowMo: 400,
    },
  },
  outputDir: './test-results',
});

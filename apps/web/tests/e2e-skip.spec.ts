import { test, expect } from '@playwright/test';

/**
 * Placeholder test file that runs when E2E environment is not configured.
 * This prevents Playwright from failing with "No tests found" error.
 */

test.describe('E2E Tests - Environment Not Ready', () => {
  test('E2E tests skipped: Run `pnpm docker:up` first', async () => {
    // This test always passes to indicate that E2E tests were intentionally skipped
    console.log('E2E tests skipped: Required environment variables not set.');
    console.log('Run `pnpm docker:up` first to start the required services.');
    expect(true).toBe(true);
  });
});

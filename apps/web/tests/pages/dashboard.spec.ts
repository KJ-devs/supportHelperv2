import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 *
 * Tests main dashboard functionality
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Skip if no test user configured
    test.skip(!process.env.TEST_USER_EMAIL, 'Test user not configured');

    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard|home/);
  });

  test.describe('Overview', () => {
    test('should display dashboard overview', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /dashboard|overview/i })).toBeVisible();
    });

    test('should show statistics cards', async ({ page }) => {
      await expect(page.getByText(/total tickets|open tickets|resolved/i)).toBeVisible();
    });

    test('should display recent activity', async ({ page }) => {
      await expect(page.getByText(/recent|activity|latest/i)).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to tickets page', async ({ page }) => {
      await page.getByRole('link', { name: /tickets/i }).click();
      await expect(page).toHaveURL(/tickets/);
    });

    test('should navigate to applications page', async ({ page }) => {
      await page.getByRole('link', { name: /applications|apps/i }).click();
      await expect(page).toHaveURL(/applications/);
    });

    test('should navigate to settings page', async ({ page }) => {
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/settings/);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should show mobile menu on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Mobile menu button should be visible
      const menuButton = page.getByRole('button', { name: /menu|navigation/i });
      await expect(menuButton).toBeVisible();

      await menuButton.click();

      // Navigation links should be visible in mobile menu
      await expect(page.getByRole('link', { name: /tickets/i })).toBeVisible();
    });
  });
});

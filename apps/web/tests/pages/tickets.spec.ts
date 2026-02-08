import { test, expect } from '@playwright/test';

/**
 * Tickets E2E Tests
 *
 * Tests ticket management functionality
 */

test.describe('Tickets', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'Test user not configured');

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL(/dashboard|home/);
    await page.goto('/tickets');
  });

  test.describe('Ticket List', () => {
    test('should display tickets page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /tickets/i })).toBeVisible();
    });

    test('should show ticket table or list', async ({ page }) => {
      await expect(page.getByRole('table').or(page.getByRole('list'))).toBeVisible();
    });

    test('should have filter options', async ({ page }) => {
      await expect(
        page.getByRole('combobox', { name: /status|filter/i }).or(page.getByText(/filter/i))
      ).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      await expect(page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))).toBeVisible();
    });
  });

  test.describe('Ticket Filtering', () => {
    test('should filter by status', async ({ page }) => {
      const statusFilter = page.getByRole('combobox', { name: /status/i });
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.getByRole('option', { name: /open|new/i }).click();

        // URL should reflect filter
        await expect(page).toHaveURL(/status=/);
      }
    });

    test('should filter by search query', async ({ page }) => {
      const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));
      if (await searchInput.isVisible()) {
        await searchInput.fill('test query');
        await searchInput.press('Enter');

        // Should show search results or empty state
        await expect(
          page.getByText(/result|found|no tickets/i).or(page.getByRole('row'))
        ).toBeVisible();
      }
    });
  });

  test.describe('Ticket Details', () => {
    test('should open ticket details', async ({ page }) => {
      // Click first ticket if available
      const ticketRow = page.getByRole('row').nth(1);
      if (await ticketRow.isVisible()) {
        await ticketRow.click();

        // Should show ticket details
        await expect(
          page.getByText(/description|details|status/i).or(page.getByRole('dialog'))
        ).toBeVisible();
      }
    });
  });

  test.describe('Create Ticket', () => {
    test('should open create ticket form', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create|new|add/i });
      if (await createButton.isVisible()) {
        await createButton.click();

        await expect(
          page.getByRole('dialog').or(page.getByRole('form')).or(page.getByLabel(/title/i))
        ).toBeVisible();
      }
    });
  });
});

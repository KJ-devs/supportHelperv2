/**
 * E2E: Sidebar navigation
 * Regression: "Tableau de bord" used to stay highlighted on every page,
 * and GitHub had its own entry duplicating Integrations.
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running. Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.');
    await login(page);
  });

  test('Given the tickets page, Then only the Tickets entry is marked current', async ({ page }) => {
    await page.goto('/dashboard/tickets');
    const nav = page.getByRole('navigation', { name: /Menu principal|Main menu|Main navigation/i });

    await expect(nav.getByRole('link', { name: 'Tickets' })).toHaveClass(/bg-blue-50/);
    await expect(nav.getByRole('link', { name: /Tableau de bord|Dashboard/ })).not.toHaveClass(/bg-blue-50/);
  });

  test('Given the GitHub page, Then it is reached from Integrations', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const nav = page.getByRole('navigation', { name: /Menu principal|Main menu|Main navigation/i });
    await expect(nav.getByRole('link', { name: 'GitHub' })).toHaveCount(0);

    await page.getByRole('link', { name: /Dépôts|Repositories/ }).click();
    await page.waitForURL('**/dashboard/github');
    await expect(nav.getByRole('link', { name: /Intégrations|Integrations/ })).toHaveClass(/bg-blue-50/);
  });
});

/**
 * E2E: Tickets list
 * Regressions: page titled "Titre", search needed an "Apply" click,
 * no way to create a ticket manually.
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

test.describe('Tickets list', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running. Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.');
    await login(page);
    await page.goto('/dashboard/tickets');
  });

  test('Given the list, Then the page is titled Tickets', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Tickets' })).toBeVisible();
  });

  test('When the user types a search, Then results are filtered without clicking Apply', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Appliquer|Apply/ })).toHaveCount(0);
    const firstTicket = page.getByRole('link', { name: /.+/ }).filter({ has: page.locator('xpath=self::a[contains(@href, "/dashboard/tickets/")]') }).first();
    const firstTitle = (await firstTicket.textContent())?.trim() ?? '';
    expect(firstTitle.length).toBeGreaterThan(0);

    await page.getByPlaceholder(/Rechercher des tickets|Search tickets/).fill('zzz-no-such-ticket-zzz');

    await expect(page.getByRole('button', { name: /Réinitialiser|Reset/ })).toBeVisible();
    await expect(page.getByRole('link', { name: firstTitle, exact: true })).toHaveCount(0);
  });

  test('When the user creates a ticket, Then its detail page opens', async ({ page }) => {
    const title = `E2E manual ticket ${Date.now()}`;

    await page.getByRole('button', { name: /Nouveau ticket|New ticket/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^Titre|^Title/).fill(title);
    await dialog.getByRole('button', { name: /Créer le ticket|Create ticket/ }).click();

    await page.waitForURL(/\/dashboard\/tickets\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // Clean up through the (now discreet) delete action
    await page.getByRole('button', { name: /Supprimer le ticket|Delete ticket/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Supprimer|Delete/ }).click();
    await page.waitForURL('**/dashboard/tickets');
  });
});

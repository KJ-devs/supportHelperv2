/**
 * E2E: Ticket Detail — Analyser Popover (model/mode selection)
 * Verifies the Analyser button opens a popover to choose AI model and agent mode.
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

test.describe('Ticket Detail - Analyser Popover', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !SERVER_AVAILABLE,
      'Dashboard server not running. Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.'
    );
    await login(page);

    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');
    const firstTicketLink = page.locator('a[href*="/dashboard/tickets/"]').first();
    await expect(firstTicketLink).toBeVisible({ timeout: 10_000 });
    await firstTicketLink.click();
    await page.waitForLoadState('networkidle');
  });

  test('Analyser button opens popover on click', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    const analyserButton = page.getByTestId('analyser-button');
    await expect(analyserButton).toBeVisible({ timeout: 10_000 });

    // Popover should not be visible initially
    await expect(page.getByTestId('analyser-popover')).not.toBeVisible();

    // Click button to open popover
    await analyserButton.click();

    await expect(page.getByTestId('analyser-popover')).toBeVisible();
  });

  test('popover contains model selection and mode buttons', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.getByTestId('analyser-button').click();
    const popover = page.getByTestId('analyser-popover');
    await expect(popover).toBeVisible();

    // Model radio buttons should be visible
    await expect(popover.getByRole('radio')).toHaveCount({ min: 2 } as any);

    // Mode buttons
    await expect(popover.getByRole('button', { name: /autonome/i })).toBeVisible();
    await expect(popover.getByRole('button', { name: /guidé/i })).toBeVisible();

    // Launch button
    await expect(popover.getByRole('button', { name: /lancer/i })).toBeVisible();
  });

  test('clicking outside the popover closes it', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.getByTestId('analyser-button').click();
    await expect(page.getByTestId('analyser-popover')).toBeVisible();

    // Click outside
    await page.click('h1');

    await expect(page.getByTestId('analyser-popover')).not.toBeVisible();
  });

  test('selecting a model radio keeps it checked', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.getByTestId('analyser-button').click();
    const popover = page.getByTestId('analyser-popover');

    const radios = popover.getByRole('radio');
    const secondRadio = radios.nth(1);
    await secondRadio.click();
    await expect(secondRadio).toBeChecked();
  });

  test('Autonome is selected by default and Guidé can be toggled', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.getByTestId('analyser-button').click();
    const popover = page.getByTestId('analyser-popover');

    const autonomeBtn = popover.getByRole('button', { name: /autonome/i });
    const guideBtn = popover.getByRole('button', { name: /guidé/i });

    // Autonome is active by default
    await expect(autonomeBtn).toHaveAttribute('data-active', 'true');
    await expect(guideBtn).toHaveAttribute('data-active', 'false');

    // Switch to Guidé
    await guideBtn.click();
    await expect(guideBtn).toHaveAttribute('data-active', 'true');
    await expect(autonomeBtn).toHaveAttribute('data-active', 'false');
  });
});

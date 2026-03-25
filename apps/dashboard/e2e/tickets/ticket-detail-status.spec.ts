/**
 * E2E: Ticket Detail — Status Change UI
 * US-P1-01: Status dropdown in ticket detail header
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

test.describe('Ticket Detail - Status Change', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running. Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.');
    await login(page);
  });

  test('displays status dropdown with current status selected', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    // Navigate to tickets list and click the first ticket
    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');
    const firstTicketLink = page.locator('a[href*="/dashboard/tickets/"]').first();
    await expect(firstTicketLink).toBeVisible({ timeout: 10_000 });
    await firstTicketLink.click();
    await page.waitForLoadState('networkidle');

    // Verify dropdown exists
    const dropdown = page.getByRole('combobox', { name: /status|statut/i });
    await expect(dropdown).toBeVisible({ timeout: 10_000 });
    // Dropdown should have a non-empty value (current status)
    const value = await dropdown.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('does not show system-only statuses in dropdown', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');
    const firstTicketLink = page.locator('a[href*="/dashboard/tickets/"]').first();
    await expect(firstTicketLink).toBeVisible({ timeout: 10_000 });
    await firstTicketLink.click();
    await page.waitForLoadState('networkidle');

    const dropdown = page.getByRole('combobox', { name: /status|statut/i });
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Get all option values
    const options = dropdown.locator('option');
    const values = await options.evaluateAll(els =>
      els.map(el => (el as HTMLOptionElement).value)
    );

    // System-only statuses should NOT be present
    expect(values).not.toContain('analyzing');
    expect(values).not.toContain('analyzed');
    expect(values).not.toContain('analysis_failed');
    expect(values).not.toContain('triaged');
    expect(values).not.toContain('fix_proposed');
    expect(values).not.toContain('merged');
    expect(values).not.toContain('new');

    // Manual statuses SHOULD be present
    expect(values).toContain('open');
    expect(values).toContain('in_progress');
    expect(values).toContain('resolved');
    expect(values).toContain('closed');
    expect(values).toContain('pending');
    expect(values).toContain('escalated');
  });

  test('changes status and shows success toast', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');

    await page.goto('/dashboard/tickets');
    await page.waitForLoadState('networkidle');
    const firstTicketLink = page.locator('a[href*="/dashboard/tickets/"]').first();
    await expect(firstTicketLink).toBeVisible({ timeout: 10_000 });
    await firstTicketLink.click();
    await page.waitForLoadState('networkidle');

    const dropdown = page.getByRole('combobox', { name: /status|statut/i });
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Change to a different status
    const currentValue = await dropdown.inputValue();
    const newStatus = currentValue === 'in_progress' ? 'open' : 'in_progress';
    await dropdown.selectOption(newStatus);

    // Expect success toast
    await expect(
      page.getByText(/updated|mis à jour/i)
    ).toBeVisible({ timeout: 5_000 });

    // Verify the dropdown reflects the new value
    await expect(dropdown).toHaveValue(newStatus);
  });
});

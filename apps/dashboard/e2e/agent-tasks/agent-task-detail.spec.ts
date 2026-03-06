import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

// Real task IDs from DB (retrieved 2026-03-06)
// 8a073e0d-ee99-4823-b60f-4cb3e1f12b75 → status: analyzing
// cbe9e647-79d4-487e-ac27-eba859d5b885 → status: failed (error: "Cancelled by user")
const TASK_ID = '8a073e0d-ee99-4823-b60f-4cb3e1f12b75';
const FAILED_TASK_ID = 'cbe9e647-79d4-487e-ac27-eba859d5b885';

// NOTE: Tests are skipped when the dashboard server (localhost:3000) is not running.
// To run: start the dashboard with `pnpm dev` then re-run with `npx playwright test`.
const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

// Auth helper uses admin@test.com but DB has owner@test.local — override credentials.
const EMAIL = 'owner@test.local';
const PASSWORD = 'password123';

test.describe('Agent Task Detail', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !SERVER_AVAILABLE,
      'Dashboard server not running (localhost:3000 returned 500). Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.'
    );
    await login(page, EMAIL, PASSWORD);
    await page.goto(`/dashboard/agent-tasks/${TASK_ID}`);
    await page.waitForSelector('[data-testid="agent-task-status-badge"]', { timeout: 10000 });
  });

  test('affiche le badge de statut', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    const badge = page.getByTestId('agent-task-status-badge');
    await expect(badge).toBeVisible();
    await expect(badge).not.toBeEmpty();
  });

  test('affiche la durée', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    const duration = page.getByTestId('agent-task-duration');
    await expect(duration).toBeVisible();
    const text = await duration.textContent();
    expect(text?.trim()).not.toBe('-');
    expect(text?.trim()).not.toBe('');
  });

  test('onglet Execution Logs affiche le terminal', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    await page.getByTestId('agent-task-tab-logs').click();
    const terminal = page.getByTestId('agent-task-logs-terminal');
    await expect(terminal).toBeVisible();
  });

  test('onglet Timeline affiche au moins une étape', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    await page.getByTestId('agent-task-tab-timeline').click();
    const firstStep = page.getByTestId('timeline-step-analyzing');
    await expect(firstStep).toBeVisible();
  });

  test('onglet Action Plan est cliquable', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    await page.getByTestId('agent-task-tab-plan').click();
    await expect(page).not.toHaveURL(/error/);
  });
});

test.describe('Agent Task Detail — failed task', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !SERVER_AVAILABLE,
      'Dashboard server not running (localhost:3000 returned 500). Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.'
    );
    await login(page, EMAIL, PASSWORD);
    await page.goto(`/dashboard/agent-tasks/${FAILED_TASK_ID}`);
    await page.waitForSelector('[data-testid="agent-task-status-badge"]', { timeout: 10000 });
  });

  test('affiche le bloc erreur pour une tâche failed', async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running');
    const errorBlock = page.getByTestId('agent-task-error');
    await expect(errorBlock).toBeVisible();
    const text = await errorBlock.textContent();
    expect(text?.trim()).not.toBe('');
  });
});

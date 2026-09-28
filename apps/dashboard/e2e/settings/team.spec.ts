/**
 * E2E: Team management
 * Regression: the "Invite a member" button did nothing and only the current
 * user was listed.
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

const SERVER_AVAILABLE = process.env.PLAYWRIGHT_SERVER_AVAILABLE === 'true';

test.describe('Settings - Team', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!SERVER_AVAILABLE, 'Dashboard server not running. Set PLAYWRIGHT_SERVER_AVAILABLE=true to run.');
    await login(page);
    await page.goto('/dashboard/settings');
    await page.getByRole('button', { name: /Équipe|Team/ }).click();
  });

  test('Given an owner, When they invite a colleague, Then the member appears as pending', async ({ page }) => {
    const email = `e2e.invite.${Date.now()}@test.local`;

    await page.getByRole('button', { name: /Inviter un membre|Invite a member/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Email/).fill(email);
    await dialog.getByLabel(/Nom|Name/).fill('E2E Invite');
    await dialog.getByRole('button', { name: /Envoyer l'invitation|Send invitation/ }).click();

    const row = page.getByRole('listitem').filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText(/Invitation en attente|Invitation pending/)).toBeVisible();

    // Clean up
    await row.getByRole('button', { name: /Retirer|Remove/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Retirer|Remove/ }).click();
    await expect(row).toHaveCount(0);
  });

  test('Given the profile tab, When the name is saved, Then a success message is shown', async ({ page }) => {
    await page.getByRole('button', { name: /Profil|Profile/ }).click();
    await page.getByRole('button', { name: /Enregistrer|Save/ }).click();

    await expect(page.getByText(/Profil mis à jour|Profile updated/)).toBeVisible();
  });
});

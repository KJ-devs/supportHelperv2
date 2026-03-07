import { Page } from '@playwright/test';

const DEFAULT_EMAIL = 'owner@test.local';
const DEFAULT_PASSWORD = 'password123';

export async function login(page: Page, email = DEFAULT_EMAIL, password = DEFAULT_PASSWORD) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for React hydration — the submit button becomes interactive after hydration
  const emailInput = page.locator('#email');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });

  // Clear and fill with retry to handle React controlled input race
  await emailInput.click();
  await emailInput.fill(email);
  await page.locator('#password').click();
  await page.locator('#password').fill(password);

  // Verify React state has the correct values before submitting
  await page.waitForFunction(
    ({ e, p }: { e: string; p: string }) => {
      const emailEl = document.querySelector<HTMLInputElement>('#email');
      const passEl = document.querySelector<HTMLInputElement>('#password');
      return emailEl?.value === e && passEl?.value === p;
    },
    { e: email, p: password },
    { timeout: 5_000 }
  );

  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

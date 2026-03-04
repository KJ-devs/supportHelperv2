import { Page } from '@playwright/test';

const DEFAULT_EMAIL = 'admin@test.com';
const DEFAULT_PASSWORD = 'Admin123!';

export async function login(page: Page, email = DEFAULT_EMAIL, password = DEFAULT_PASSWORD) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**');
}

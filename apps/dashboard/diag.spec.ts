import { test, expect } from '@playwright/test';

test('diagnose login', async ({ page }) => {
  await page.goto('/login');
  console.log('URL after goto:', page.url());
  
  // Wait for networkidle
  await page.waitForLoadState('networkidle');
  console.log('Network idle reached');
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Take screenshot
  await page.screenshot({ path: 'e2e-results/diag-1-after-networkidle.png' });
  
  // Check if email input exists and is interactable
  const emailInput = page.locator('#email');
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  
  // Check React hydration by evaluating some state
  const isHydrated = await page.evaluate(() => {
    const emailEl = document.querySelector('#email') as any;
    // Check if React has attached a fiber node (hydration signal)
    return !!(emailEl && (emailEl._reactFiber || emailEl.__reactFiber || Object.keys(emailEl).some(k => k.startsWith('__react'))));
  });
  console.log('React hydrated:', isHydrated);
  
  // Try filling
  await page.locator('#email').fill('owner@test.local');
  const emailVal = await page.locator('#email').inputValue();
  console.log('Email value after fill:', emailVal);
  
  // Check React state
  const reactEmailState = await page.evaluate(() => {
    const emailEl = document.querySelector('#email') as HTMLInputElement;
    return emailEl?.value;
  });
  console.log('DOM email value:', reactEmailState);
  
  await page.screenshot({ path: 'e2e-results/diag-2-after-fill.png' });
  
  // Try clicking submit and see what happens
  await page.locator('#password').fill('password123');
  await page.screenshot({ path: 'e2e-results/diag-3-filled.png' });
});

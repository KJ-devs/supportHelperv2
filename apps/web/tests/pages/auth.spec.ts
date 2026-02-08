import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests login and registration flows
 */

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: /login|sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('button', { name: /login|sign in/i }).click();

      await expect(page.getByText(/email.*required|please enter/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /login|sign in/i }).click();

      await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: /register|sign up|create account/i }).click();

      await expect(page).toHaveURL(/register|signup/);
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      // This test requires a seeded test user
      test.skip(!process.env.TEST_USER_EMAIL, 'Test user not configured');

      await page.goto('/login');

      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
      await page.getByRole('button', { name: /login|sign in/i }).click();

      await expect(page).toHaveURL(/dashboard|home/);
    });
  });

  test.describe('Register Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /register|sign up|create/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
    });

    test('should show validation errors for weak password', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/^password$/i).fill('123');
      await page.getByLabel(/name/i).fill('Test User');

      await page.getByRole('button', { name: /register|sign up|create/i }).click();

      await expect(page.getByText(/password.*character|too short|minimum/i)).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');

      await page.getByRole('link', { name: /login|sign in|already have/i }).click();

      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      test.skip(!process.env.TEST_USER_EMAIL, 'Test user not configured');

      // Login first
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
      await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
      await page.getByRole('button', { name: /login|sign in/i }).click();

      await expect(page).toHaveURL(/dashboard|home/);

      // Now logout
      await page.getByRole('button', { name: /user|profile|menu/i }).click();
      await page.getByRole('menuitem', { name: /logout|sign out/i }).click();

      await expect(page).toHaveURL(/login/);
    });
  });
});

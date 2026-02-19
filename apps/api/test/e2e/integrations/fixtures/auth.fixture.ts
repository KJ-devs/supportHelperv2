import { test as base, type APIRequestContext } from '@playwright/test';
import * as jwt from 'jsonwebtoken';

/**
 * JWT payload matching the API's JwtPayload interface.
 */
interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  type: 'access' | 'refresh';
}

/**
 * Generate a JWT token for testing.
 * Uses the default dev secret from .env.example.
 */
export function generateTestToken(payload: Omit<JwtPayload, 'type'>): string {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  return jwt.sign(
    { ...payload, type: 'access' as const },
    secret,
    { expiresIn: '1h' },
  );
}

/**
 * Test tenant and user data for Tenant A (primary).
 */
export const TENANT_A = {
  id: 'e2e-tenant-a-id-0001',
  name: 'E2E Tenant A',
  slug: 'e2e-tenant-a',
  userId: 'e2e-user-a-id-0001',
  email: 'admin-a@e2e-test.local',
  role: 'owner' as const,
};

/**
 * Test tenant and user data for Tenant B (isolation tests).
 */
export const TENANT_B = {
  id: 'e2e-tenant-b-id-0002',
  name: 'E2E Tenant B',
  slug: 'e2e-tenant-b',
  userId: 'e2e-user-b-id-0002',
  email: 'admin-b@e2e-test.local',
  role: 'owner' as const,
};

/**
 * Pre-generated JWT tokens for each tenant.
 */
export function getTokenForTenant(tenant: typeof TENANT_A | typeof TENANT_B): string {
  return generateTestToken({
    sub: tenant.userId,
    email: tenant.email,
    tenantId: tenant.id,
    role: tenant.role,
  });
}

/**
 * Extended Playwright test fixture that provides an authenticated API request context.
 */
export interface AuthFixtures {
  /** API request context authenticated as Tenant A owner */
  authedRequestA: APIRequestContext;
  /** API request context authenticated as Tenant B owner */
  authedRequestB: APIRequestContext;
  /** JWT token for Tenant A */
  tokenA: string;
  /** JWT token for Tenant B */
  tokenB: string;
}

export const test = base.extend<AuthFixtures>({
  tokenA: async ({}, use) => {
    await use(getTokenForTenant(TENANT_A));
  },

  tokenB: async ({}, use) => {
    await use(getTokenForTenant(TENANT_B));
  },

  authedRequestA: async ({ playwright }, use) => {
    const token = getTokenForTenant(TENANT_A);
    const context = await playwright.request.newContext({
      baseURL: process.env.TEST_API_URL || 'http://localhost:3001',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    await use(context);
    await context.dispose();
  },

  authedRequestB: async ({ playwright }, use) => {
    const token = getTokenForTenant(TENANT_B);
    const context = await playwright.request.newContext({
      baseURL: process.env.TEST_API_URL || 'http://localhost:3001',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';

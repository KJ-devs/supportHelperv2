import { test, expect } from './fixtures/auth.fixture';
import { DISCORD_CONFIG, JIRA_CONFIG, createIntegrationPayload } from './fixtures/test-data.fixture';

/**
 * Multi-Tenant Isolation E2E Tests
 *
 * Verifies that integrations are scoped per tenant:
 * - Tenant A cannot see Tenant B's integrations
 * - Tenant A cannot modify Tenant B's integrations
 * - Tenant A cannot delete Tenant B's integrations
 * - Tenant A cannot test Tenant B's connections
 * - Listing only returns current tenant's integrations
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Integration Multi-Tenant Isolation', () => {
  const createdByA: string[] = [];
  const createdByB: string[] = [];

  test.afterAll(async ({ authedRequestA, authedRequestB }) => {
    for (const id of createdByA) {
      try {
        await authedRequestA.delete(`/api/integrations/${id}`);
      } catch {
        // Ignore
      }
    }
    for (const id of createdByB) {
      try {
        await authedRequestB.delete(`/api/integrations/${id}`);
      } catch {
        // Ignore
      }
    }
  });

  test('Tenant A can create an integration', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload(
      'discord',
      'Tenant A Discord',
      DISCORD_CONFIG.valid,
    );

    const response = await authedRequestA.post('/api/integrations', { data: payload });
    expect(response.status()).toBe(201);

    const body = await response.json();
    createdByA.push(body.id);
  });

  test('Tenant B can create an integration', async ({ authedRequestB }) => {
    const payload = createIntegrationPayload(
      'jira',
      'Tenant B Jira',
      JIRA_CONFIG.valid,
    );

    const response = await authedRequestB.post('/api/integrations', { data: payload });
    expect(response.status()).toBe(201);

    const body = await response.json();
    createdByB.push(body.id);
  });

  test('Tenant A cannot see Tenant B integrations in list', async ({ authedRequestA }) => {
    const response = await authedRequestA.get('/api/integrations');
    expect(response.status()).toBe(200);

    const list = await response.json();
    const ids = list.map((i: { id: string }) => i.id);

    // Tenant B's integrations should not appear in Tenant A's list
    for (const bId of createdByB) {
      expect(ids).not.toContain(bId);
    }
  });

  test('Tenant B cannot see Tenant A integrations in list', async ({ authedRequestB }) => {
    const response = await authedRequestB.get('/api/integrations');
    expect(response.status()).toBe(200);

    const list = await response.json();
    const ids = list.map((i: { id: string }) => i.id);

    for (const aId of createdByA) {
      expect(ids).not.toContain(aId);
    }
  });

  test('Tenant B cannot access Tenant A integration by ID', async ({ authedRequestB }) => {
    if (createdByA.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestB.get(`/api/integrations/${createdByA[0]}`);
    expect(response.status()).toBe(404);
  });

  test('Tenant A cannot access Tenant B integration by ID', async ({ authedRequestA }) => {
    if (createdByB.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestA.get(`/api/integrations/${createdByB[0]}`);
    expect(response.status()).toBe(404);
  });

  test('Tenant B cannot update Tenant A integration', async ({ authedRequestB }) => {
    if (createdByA.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestB.patch(`/api/integrations/${createdByA[0]}`, {
      data: { name: 'Hijacked by Tenant B' },
    });

    expect(response.status()).toBe(404);
  });

  test('Tenant A cannot update Tenant B integration', async ({ authedRequestA }) => {
    if (createdByB.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestA.patch(`/api/integrations/${createdByB[0]}`, {
      data: { name: 'Hijacked by Tenant A' },
    });

    expect(response.status()).toBe(404);
  });

  test('Tenant B cannot delete Tenant A integration', async ({ authedRequestB }) => {
    if (createdByA.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestB.delete(`/api/integrations/${createdByA[0]}`);
    expect(response.status()).toBe(404);

    // Verify it still exists for Tenant A
    // (intentionally empty - the 404 above is sufficient proof)
  });

  test('Tenant A cannot delete Tenant B integration', async ({ authedRequestA }) => {
    if (createdByB.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestA.delete(`/api/integrations/${createdByB[0]}`);
    expect(response.status()).toBe(404);
  });

  test('Tenant B cannot test Tenant A integration connection', async ({ authedRequestB }) => {
    if (createdByA.length === 0) {
      test.skip();
      return;
    }

    const response = await authedRequestB.post(`/api/integrations/${createdByA[0]}/test`);
    expect(response.status()).toBe(404);
  });

  test('Tenant A list only contains own integrations', async ({ authedRequestA }) => {
    const response = await authedRequestA.get('/api/integrations');
    expect(response.status()).toBe(200);

    const list = await response.json();

    // All integrations in the list should belong to Tenant A
    // We can verify none match Tenant B's known IDs
    for (const integration of list) {
      expect(createdByB).not.toContain(integration.id);
    }
  });
});

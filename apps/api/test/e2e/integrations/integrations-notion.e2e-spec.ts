import { test, expect } from './fixtures/auth.fixture';
import { NOTION_CONFIG, createIntegrationPayload } from './fixtures/test-data.fixture';

/**
 * Notion Integration E2E Tests
 *
 * Tests Notion-specific flows:
 * - Create Notion integration with API key and database ID
 * - Config validation (apiToken and databaseId required)
 * - Connection test endpoint
 * - Error handling (invalid token, nonexistent database)
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Notion Integration E2E', () => {
  const createdIds: string[] = [];

  test.afterAll(async ({ authedRequestA }) => {
    for (const id of createdIds) {
      try {
        await authedRequestA.delete(`/api/integrations/${id}`);
      } catch {
        // Ignore
      }
    }
  });

  test('should create a Notion integration with valid config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('notion', 'E2E Notion Test', NOTION_CONFIG.valid);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('notion');
    expect(body.config.apiToken).toBe(NOTION_CONFIG.valid.apiToken);
    expect(body.config.databaseId).toBe(NOTION_CONFIG.valid.databaseId);
    expect(body.configIv).toBeUndefined();

    createdIds.push(body.id);
  });

  test('should reject Notion integration with missing apiToken', async ({ authedRequestA }) => {
    const badConfig = { databaseId: 'some-db-id' };
    const payload = createIntegrationPayload('notion', 'Bad Notion No Token', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Integration Token is required');
  });

  test('should reject Notion integration with missing databaseId', async ({ authedRequestA }) => {
    const badConfig = { apiToken: 'secret_test_token' };
    const payload = createIntegrationPayload('notion', 'Bad Notion No DB', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Database ID is required');
  });

  test('should handle Notion connection test failure gracefully', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('notion', 'E2E Notion Fail', NOTION_CONFIG.valid);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Connection test with fake token will fail against real Notion API
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBeTruthy();
  });

  test('should update Notion integration databaseId', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('notion', 'E2E Notion Update', NOTION_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();
    createdIds.push(created.id);

    const newDatabaseId = 'bbbbccccddddeeee2222333344445555';
    const updateResp = await authedRequestA.patch(`/api/integrations/${created.id}`, {
      data: {
        config: {
          ...NOTION_CONFIG.valid,
          databaseId: newDatabaseId,
        },
      },
    });

    expect(updateResp.status()).toBe(200);

    const updated = await updateResp.json();
    expect(updated.config.databaseId).toBe(newDatabaseId);
  });

  test('should delete Notion integration', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('notion', 'E2E Notion Delete', NOTION_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();

    const deleteResp = await authedRequestA.delete(`/api/integrations/${created.id}`);
    expect(deleteResp.status()).toBe(200);

    const getResp = await authedRequestA.get(`/api/integrations/${created.id}`);
    expect(getResp.status()).toBe(404);
  });
});

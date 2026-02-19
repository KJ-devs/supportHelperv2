import { test, expect } from './fixtures/auth.fixture';
import { SLACK_CONFIG, createIntegrationPayload } from './fixtures/test-data.fixture';

/**
 * Slack Integration E2E Tests
 *
 * Tests Slack-specific flows:
 * - Create Slack integration with webhook URL
 * - Config validation (botToken and channel required)
 * - Connection test endpoint
 * - Error handling (invalid webhook, missing channel)
 *
 * Slack SDK (WebClient) calls are made server-side; these tests
 * verify the API layer accepts/rejects correctly.
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Slack Integration E2E', () => {
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

  test('should create a Slack integration with valid config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('slack', 'E2E Slack Test', SLACK_CONFIG.valid);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('slack');
    expect(body.config.botToken).toBe(SLACK_CONFIG.valid.botToken);
    expect(body.config.channel).toBe(SLACK_CONFIG.valid.channel);
    expect(body.configIv).toBeUndefined();

    createdIds.push(body.id);
  });

  test('should reject Slack integration with missing botToken', async ({ authedRequestA }) => {
    const badConfig = { channel: '#support' };
    const payload = createIntegrationPayload('slack', 'Bad Slack No Token', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Bot Token is required');
  });

  test('should reject Slack integration with missing channel', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('slack', 'Bad Slack No Channel', SLACK_CONFIG.missingRequired);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Channel is required');
  });

  test('should handle Slack connection test failure gracefully', async ({ authedRequestA }) => {
    // Create a Slack integration with a fake token
    const payload = createIntegrationPayload('slack', 'E2E Slack Fail Test', {
      botToken: 'xoxb-fake-token-that-wont-work',
      channel: '#nonexistent',
    });

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Test connection - should fail but not crash
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBeTruthy();
  });

  test('should update Slack integration channel', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('slack', 'E2E Slack Update', SLACK_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();
    createdIds.push(created.id);

    const updateResp = await authedRequestA.patch(`/api/integrations/${created.id}`, {
      data: {
        config: {
          botToken: SLACK_CONFIG.valid.botToken,
          channel: '#updated-channel',
        },
      },
    });

    expect(updateResp.status()).toBe(200);

    const updated = await updateResp.json();
    expect(updated.config.channel).toBe('#updated-channel');
  });

  test('should delete Slack integration', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('slack', 'E2E Slack Delete', SLACK_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();

    const deleteResp = await authedRequestA.delete(`/api/integrations/${created.id}`);
    expect(deleteResp.status()).toBe(200);

    // Verify it's gone
    const getResp = await authedRequestA.get(`/api/integrations/${created.id}`);
    expect(getResp.status()).toBe(404);
  });
});

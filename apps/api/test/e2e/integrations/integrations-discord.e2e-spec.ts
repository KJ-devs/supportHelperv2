import { test, expect } from './fixtures/auth.fixture';
import {
  DISCORD_CONFIG,
  createIntegrationPayload,
} from './fixtures/test-data.fixture';
import { startMockProviderServer, stopMockProviderServer } from './fixtures/mock-providers.fixture';
import type http from 'http';

/**
 * Discord Integration E2E Tests
 *
 * Tests Discord-specific flows:
 * - Create Discord integration with webhook URL
 * - Config validation (webhookUrl required)
 * - Connection test via mock webhook server
 * - Optional fields (username, avatarUrl)
 * - Error handling
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Discord Integration E2E', () => {
  let mockServer: http.Server;
  let mockBaseUrl: string;
  const createdIds: string[] = [];

  test.beforeAll(async () => {
    const mock = await startMockProviderServer();
    mockServer = mock.server;
    mockBaseUrl = mock.baseUrl;
  });

  test.afterAll(async ({ authedRequestA }) => {
    for (const id of createdIds) {
      try {
        await authedRequestA.delete(`/api/integrations/${id}`);
      } catch {
        // Ignore
      }
    }
    await stopMockProviderServer(mockServer);
  });

  test('should create a Discord integration with valid config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('discord', 'E2E Discord Test', DISCORD_CONFIG.valid);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('discord');
    expect(body.config.webhookUrl).toBe(DISCORD_CONFIG.valid.webhookUrl);
    expect(body.configIv).toBeUndefined();

    createdIds.push(body.id);
  });

  test('should create Discord integration with optional fields', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload(
      'discord',
      'E2E Discord With Options',
      DISCORD_CONFIG.withOptional,
    );

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.config.username).toBe('E2E Test Bot');
    expect(body.config.avatarUrl).toBe('https://example.com/avatar.png');

    createdIds.push(body.id);
  });

  test('should reject Discord integration with missing webhookUrl', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload(
      'discord',
      'Bad Discord No Webhook',
      DISCORD_CONFIG.missingRequired,
    );

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Webhook URL is required');
  });

  test('should test Discord connection using mock webhook server', async ({ authedRequestA }) => {
    // Point webhook URL at the mock server
    const config = {
      webhookUrl: `${mockBaseUrl}/api/webhooks/mock-id/mock-token`,
    };
    const payload = createIntegrationPayload('discord', 'E2E Discord Mock Connection', config);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Test connection
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(true);
    expect(testResult.message).toContain('Discord');
  });

  test('should handle Discord connection test failure', async ({ authedRequestA }) => {
    const config = {
      webhookUrl: 'http://127.0.0.1:1/api/webhooks/bad/token',
    };
    const payload = createIntegrationPayload('discord', 'E2E Discord Fail', config);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBeTruthy();
  });

  test('should update Discord webhook URL', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('discord', 'E2E Discord Update', DISCORD_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();
    createdIds.push(created.id);

    const newUrl = 'https://discord.com/api/webhooks/updated/new-token';
    const updateResp = await authedRequestA.patch(`/api/integrations/${created.id}`, {
      data: { config: { webhookUrl: newUrl } },
    });

    expect(updateResp.status()).toBe(200);

    const updated = await updateResp.json();
    expect(updated.config.webhookUrl).toBe(newUrl);
  });

  test('should delete Discord integration', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('discord', 'E2E Discord Delete', DISCORD_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();

    const deleteResp = await authedRequestA.delete(`/api/integrations/${created.id}`);
    expect(deleteResp.status()).toBe(200);

    const getResp = await authedRequestA.get(`/api/integrations/${created.id}`);
    expect(getResp.status()).toBe(404);
  });
});

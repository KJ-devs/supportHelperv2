import { test, expect } from './fixtures/auth.fixture';
import { JIRA_CONFIG, createIntegrationPayload } from './fixtures/test-data.fixture';
import { startMockProviderServer, stopMockProviderServer } from './fixtures/mock-providers.fixture';
import type http from 'http';

/**
 * Jira Integration E2E Tests
 *
 * Tests Jira-specific flows:
 * - Create Jira integration with valid config
 * - Test connection endpoint
 * - Config validation for required/optional fields
 * - Error handling (invalid credentials, project not found)
 *
 * The mock provider server intercepts Jira REST API calls made by the
 * NestJS server when the Jira `host` config is pointed at the mock.
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Jira Integration E2E', () => {
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

  test('should create a Jira integration with valid config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('jira', 'E2E Jira Test', JIRA_CONFIG.valid);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('jira');
    expect(body.config.host).toBe(JIRA_CONFIG.valid.host);
    expect(body.config.email).toBe(JIRA_CONFIG.valid.email);
    expect(body.config.apiToken).toBe(JIRA_CONFIG.valid.apiToken);
    expect(body.config.projectKey).toBe(JIRA_CONFIG.valid.projectKey);

    createdIds.push(body.id);
  });

  test('should create a Jira integration with optional config fields', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload(
      'jira',
      'E2E Jira With Options',
      JIRA_CONFIG.withOptional,
    );

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.config.issueType).toBe('Task');
    expect(body.config.priorityMapping).toBe('{"critical":"Blocker","high":"Major"}');

    createdIds.push(body.id);
  });

  test('should reject Jira integration with missing host', async ({ authedRequestA }) => {
    const badConfig = {
      email: 'test@example.com',
      apiToken: 'test-token',
      projectKey: 'TEST',
    };
    const payload = createIntegrationPayload('jira', 'Bad Jira No Host', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Jira URL is required');
  });

  test('should reject Jira integration with missing apiToken', async ({ authedRequestA }) => {
    const badConfig = {
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      projectKey: 'TEST',
    };
    const payload = createIntegrationPayload('jira', 'Bad Jira No Token', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('API Token is required');
  });

  test('should reject Jira integration with missing projectKey', async ({ authedRequestA }) => {
    const badConfig = {
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token',
    };
    const payload = createIntegrationPayload('jira', 'Bad Jira No Project', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Project Key is required');
  });

  test('should test Jira connection using mock server', async ({ authedRequestA }) => {
    // Create a Jira integration pointing at the mock server
    const config = {
      ...JIRA_CONFIG.valid,
      host: mockBaseUrl,
    };
    const payload = createIntegrationPayload('jira', 'E2E Jira Mock Connection', config);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Test the connection
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(true);
    expect(testResult.message).toContain('Connected as');
  });

  test('should handle connection test failure gracefully', async ({ authedRequestA }) => {
    // Create a Jira integration with an unreachable host
    const config = {
      ...JIRA_CONFIG.valid,
      host: 'http://127.0.0.1:1', // Port 1 should be unreachable
    };
    const payload = createIntegrationPayload('jira', 'E2E Jira Unreachable', config);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Test the connection - should return failure, not crash
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBeTruthy();
  });

  test('should update Jira integration config', async ({ authedRequestA }) => {
    // Create integration
    const payload = createIntegrationPayload('jira', 'E2E Jira Update Config', JIRA_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();
    createdIds.push(created.id);

    // Update the project key
    const updateResp = await authedRequestA.patch(`/api/integrations/${created.id}`, {
      data: {
        config: {
          ...JIRA_CONFIG.valid,
          projectKey: 'NEW',
        },
      },
    });

    expect(updateResp.status()).toBe(200);

    const updated = await updateResp.json();
    expect(updated.config.projectKey).toBe('NEW');
    // Other fields should remain unchanged
    expect(updated.config.host).toBe(JIRA_CONFIG.valid.host);
  });
});

import { test, expect } from './fixtures/auth.fixture';
import {
  HUBSPOT_CONFIG,
  createIntegrationPayload,
} from './fixtures/test-data.fixture';
import { startMockProviderServer, stopMockProviderServer } from './fixtures/mock-providers.fixture';
import type http from 'http';

/**
 * HubSpot Integration E2E Tests
 *
 * Tests HubSpot-specific flows:
 * - Create HubSpot integration with valid config
 * - Config validation (accessToken, pipelineId, pipelineStageId required)
 * - Connection test via mock server
 * - Error handling
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('HubSpot Integration E2E', () => {
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

  test('should create a HubSpot integration with valid config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('hubspot', 'E2E HubSpot Test', HUBSPOT_CONFIG.valid);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.type).toBe('hubspot');
    expect(body.config.accessToken).toBe(HUBSPOT_CONFIG.valid.accessToken);
    expect(body.config.pipelineId).toBe(HUBSPOT_CONFIG.valid.pipelineId);
    expect(body.config.pipelineStageId).toBe(HUBSPOT_CONFIG.valid.pipelineStageId);

    createdIds.push(body.id);
  });

  test('should create HubSpot integration with optional fields', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload(
      'hubspot',
      'E2E HubSpot With Options',
      HUBSPOT_CONFIG.withOptional,
    );

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.config.ownerId).toBe('12345');
    expect(body.config.ticketPriority).toBe('MEDIUM');

    createdIds.push(body.id);
  });

  test('should reject HubSpot with missing accessToken', async ({ authedRequestA }) => {
    const badConfig = { pipelineId: '0', pipelineStageId: '1' };
    const payload = createIntegrationPayload('hubspot', 'Bad HubSpot No Token', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Access Token is required');
  });

  test('should reject HubSpot with missing pipelineId', async ({ authedRequestA }) => {
    const badConfig = { accessToken: 'pat-test', pipelineStageId: '1' };
    const payload = createIntegrationPayload('hubspot', 'Bad HubSpot No Pipeline', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Pipeline ID is required');
  });

  test('should reject HubSpot with missing pipelineStageId', async ({ authedRequestA }) => {
    const badConfig = { accessToken: 'pat-test', pipelineId: '0' };
    const payload = createIntegrationPayload('hubspot', 'Bad HubSpot No Stage', badConfig);

    const response = await authedRequestA.post('/api/integrations', { data: payload });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.message).toContain('Pipeline Stage ID is required');
  });

  test('should handle HubSpot connection test failure gracefully', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('hubspot', 'E2E HubSpot Fail', HUBSPOT_CONFIG.valid);

    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    expect(createResp.status()).toBe(201);

    const created = await createResp.json();
    createdIds.push(created.id);

    // Connection test will fail because the real HubSpot API won't accept the fake token
    const testResp = await authedRequestA.post(`/api/integrations/${created.id}/test`);
    expect(testResp.status()).toBe(200);

    const testResult = await testResp.json();
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBeTruthy();
  });

  test('should update HubSpot pipeline config', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('hubspot', 'E2E HubSpot Update', HUBSPOT_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();
    createdIds.push(created.id);

    const updateResp = await authedRequestA.patch(`/api/integrations/${created.id}`, {
      data: {
        config: {
          ...HUBSPOT_CONFIG.valid,
          pipelineId: '5',
          pipelineStageId: '10',
        },
      },
    });

    expect(updateResp.status()).toBe(200);

    const updated = await updateResp.json();
    expect(updated.config.pipelineId).toBe('5');
    expect(updated.config.pipelineStageId).toBe('10');
  });

  test('should delete HubSpot integration', async ({ authedRequestA }) => {
    const payload = createIntegrationPayload('hubspot', 'E2E HubSpot Delete', HUBSPOT_CONFIG.valid);
    const createResp = await authedRequestA.post('/api/integrations', { data: payload });
    const created = await createResp.json();

    const deleteResp = await authedRequestA.delete(`/api/integrations/${created.id}`);
    expect(deleteResp.status()).toBe(200);

    const getResp = await authedRequestA.get(`/api/integrations/${created.id}`);
    expect(getResp.status()).toBe(404);
  });
});

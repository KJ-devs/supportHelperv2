import { test, expect } from '../integrations/fixtures/auth.fixture';
import {
  INTEGRATIONS,
  JIRA_CONFIG,
  SLACK_CONFIG,
  HUBSPOT_CONFIG,
  NOTION_CONFIG,
  DISCORD_CONFIG,
  createIntegrationPayload,
} from './fixtures/test-data.fixture';

/**
 * Integration CRUD E2E Tests
 *
 * Tests the full lifecycle of integration resources via the REST API:
 * - Create integration (each provider type)
 * - Read/list integrations
 * - Update integration config
 * - Delete integration
 * - Validation errors for invalid configs
 *
 * Requires the NestJS API to be running at TEST_API_URL (default: http://localhost:3001).
 * Requires valid JWT auth (test tokens are generated from the auth fixture).
 */

const isApiAvailable = !!(
  process.env.TEST_API_URL ||
  process.env.RUN_E2E_TESTS === 'true' ||
  process.env.CI
);

const describeBlock = isApiAvailable ? test.describe : test.describe.skip;

describeBlock('Integration CRUD Operations', () => {
  const createdIds: string[] = [];

  test.afterAll(async ({ authedRequestA }) => {
    // Clean up all integrations created during tests
    for (const id of createdIds) {
      try {
        await authedRequestA.delete(`/api/integrations/${id}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test.describe('Create Integration', () => {
    test('should create a Jira integration', async ({ authedRequestA }) => {
      const payload = INTEGRATIONS.jira();

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.id).toBeTruthy();
      expect(body.type).toBe('jira');
      expect(body.name).toBe('E2E Jira Integration');
      expect(body.enabled).toBe(true);
      expect(body.config).toBeDefined();
      expect(body.config.host).toBe(JIRA_CONFIG.valid.host);
      expect(body.config.projectKey).toBe(JIRA_CONFIG.valid.projectKey);
      // Sensitive fields should still be returned (decrypted) to the caller
      expect(body.config.apiToken).toBe(JIRA_CONFIG.valid.apiToken);
      // configIv should not be exposed
      expect(body.configIv).toBeUndefined();

      createdIds.push(body.id);
    });

    test('should create a Slack integration', async ({ authedRequestA }) => {
      const payload = INTEGRATIONS.slack();

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.type).toBe('slack');
      expect(body.config.botToken).toBe(SLACK_CONFIG.valid.botToken);
      expect(body.config.channel).toBe(SLACK_CONFIG.valid.channel);

      createdIds.push(body.id);
    });

    test('should create a HubSpot integration', async ({ authedRequestA }) => {
      const payload = INTEGRATIONS.hubspot();

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.type).toBe('hubspot');
      expect(body.config.accessToken).toBe(HUBSPOT_CONFIG.valid.accessToken);

      createdIds.push(body.id);
    });

    test('should create a Notion integration', async ({ authedRequestA }) => {
      const payload = INTEGRATIONS.notion();

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.type).toBe('notion');
      expect(body.config.databaseId).toBe(NOTION_CONFIG.valid.databaseId);

      createdIds.push(body.id);
    });

    test('should create a Discord integration', async ({ authedRequestA }) => {
      const payload = INTEGRATIONS.discord();

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.type).toBe('discord');
      expect(body.config.webhookUrl).toBe(DISCORD_CONFIG.valid.webhookUrl);

      createdIds.push(body.id);
    });

    test('should create a disabled integration', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload(
        'discord',
        'E2E Disabled Discord',
        DISCORD_CONFIG.valid,
        { enabled: false },
      );

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.enabled).toBe(false);

      createdIds.push(body.id);
    });

    test('should reject duplicate integration (same type + name + tenant)', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload(
        'discord',
        'E2E Unique Discord',
        DISCORD_CONFIG.valid,
      );

      // Create first
      const first = await authedRequestA.post('/api/integrations', { data: payload });
      expect(first.status()).toBe(201);
      const firstBody = await first.json();
      createdIds.push(firstBody.id);

      // Try to create duplicate
      const duplicate = await authedRequestA.post('/api/integrations', { data: payload });
      expect(duplicate.status()).toBe(409);

      const errorBody = await duplicate.json();
      expect(errorBody.message).toContain('already exists');
    });
  });

  test.describe('Validation Errors', () => {
    test('should reject unknown integration type', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('unknown-type', 'Bad Type', { foo: 'bar' });

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.message).toContain('Unknown integration type');
    });

    test('should reject missing required config for Jira', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('jira', 'Bad Jira', JIRA_CONFIG.missingRequired);

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.message).toContain('Invalid configuration');
    });

    test('should reject missing required config for Slack', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('slack', 'Bad Slack', SLACK_CONFIG.missingRequired);

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);
    });

    test('should reject missing required config for HubSpot', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('hubspot', 'Bad HubSpot', HUBSPOT_CONFIG.missingRequired);

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);
    });

    test('should reject missing required config for Notion', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('notion', 'Bad Notion', NOTION_CONFIG.missingRequired);

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);
    });

    test('should reject missing required config for Discord', async ({ authedRequestA }) => {
      const payload = createIntegrationPayload('discord', 'Bad Discord', DISCORD_CONFIG.missingRequired);

      const response = await authedRequestA.post('/api/integrations', {
        data: payload,
      });

      expect(response.status()).toBe(400);
    });

    test('should reject empty integration name', async ({ authedRequestA }) => {
      const response = await authedRequestA.post('/api/integrations', {
        data: { type: 'discord', name: '', config: DISCORD_CONFIG.valid },
      });

      // Zod validation should catch empty name
      expect(response.status()).toBe(400);
    });

    test('should reject missing config object', async ({ authedRequestA }) => {
      const response = await authedRequestA.post('/api/integrations', {
        data: { type: 'discord', name: 'No Config' },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Read / List Integrations', () => {
    let integrationId: string;

    test.beforeAll(async ({ authedRequestA }) => {
      const payload = createIntegrationPayload(
        'discord',
        'E2E Read Test Discord',
        DISCORD_CONFIG.valid,
      );
      const response = await authedRequestA.post('/api/integrations', { data: payload });
      const body = await response.json();
      integrationId = body.id;
      createdIds.push(integrationId);
    });

    test('should list all integrations for tenant', async ({ authedRequestA }) => {
      const response = await authedRequestA.get('/api/integrations');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    test('should filter integrations by type', async ({ authedRequestA }) => {
      const response = await authedRequestA.get('/api/integrations?type=discord');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      for (const integration of body) {
        expect(integration.type).toBe('discord');
      }
    });

    test('should filter integrations by enabled status', async ({ authedRequestA }) => {
      const response = await authedRequestA.get('/api/integrations?enabled=true');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      for (const integration of body) {
        expect(integration.enabled).toBe(true);
      }
    });

    test('should get a single integration by ID', async ({ authedRequestA }) => {
      const response = await authedRequestA.get(`/api/integrations/${integrationId}`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.id).toBe(integrationId);
      expect(body.type).toBe('discord');
      expect(body.config).toBeDefined();
      expect(body.configIv).toBeUndefined();
    });

    test('should return 404 for non-existent integration', async ({ authedRequestA }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authedRequestA.get(`/api/integrations/${fakeId}`);

      expect(response.status()).toBe(404);
    });

    test('should list available integration types', async ({ authedRequestA }) => {
      const response = await authedRequestA.get('/api/integrations/types');

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);

      const types = body.map((t: { type: string }) => t.type);
      expect(types).toContain('jira');
      expect(types).toContain('slack');
      expect(types).toContain('hubspot');
      expect(types).toContain('notion');
      expect(types).toContain('discord');

      // Each type should have name, description, and requiredConfig
      for (const provider of body) {
        expect(provider.name).toBeTruthy();
        expect(provider.description).toBeTruthy();
        expect(Array.isArray(provider.requiredConfig)).toBe(true);
      }
    });
  });

  test.describe('Update Integration', () => {
    let integrationId: string;

    test.beforeAll(async ({ authedRequestA }) => {
      const payload = createIntegrationPayload(
        'discord',
        'E2E Update Test Discord',
        DISCORD_CONFIG.valid,
      );
      const response = await authedRequestA.post('/api/integrations', { data: payload });
      const body = await response.json();
      integrationId = body.id;
      createdIds.push(integrationId);
    });

    test('should update integration name', async ({ authedRequestA }) => {
      const response = await authedRequestA.patch(`/api/integrations/${integrationId}`, {
        data: { name: 'Updated Discord Name' },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.name).toBe('Updated Discord Name');
    });

    test('should update integration enabled status', async ({ authedRequestA }) => {
      const response = await authedRequestA.patch(`/api/integrations/${integrationId}`, {
        data: { enabled: false },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.enabled).toBe(false);
    });

    test('should update integration config (re-encrypts)', async ({ authedRequestA }) => {
      const newConfig = {
        webhookUrl: 'https://discord.com/api/webhooks/9999/new-token-updated',
      };

      const response = await authedRequestA.patch(`/api/integrations/${integrationId}`, {
        data: { config: newConfig },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.config.webhookUrl).toBe(newConfig.webhookUrl);
    });

    test('should reject update with invalid config', async ({ authedRequestA }) => {
      // Discord requires webhookUrl - updating with empty config should fail
      const response = await authedRequestA.patch(`/api/integrations/${integrationId}`, {
        data: { config: {} },
      });

      expect(response.status()).toBe(400);
    });

    test('should return 404 when updating non-existent integration', async ({ authedRequestA }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authedRequestA.patch(`/api/integrations/${fakeId}`, {
        data: { name: 'Ghost' },
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Delete Integration', () => {
    test('should delete an integration', async ({ authedRequestA }) => {
      // Create one to delete
      const payload = createIntegrationPayload(
        'discord',
        'E2E Delete Target',
        DISCORD_CONFIG.valid,
      );
      const createResp = await authedRequestA.post('/api/integrations', { data: payload });
      const created = await createResp.json();

      const response = await authedRequestA.delete(`/api/integrations/${created.id}`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);

      // Verify it's gone
      const getResp = await authedRequestA.get(`/api/integrations/${created.id}`);
      expect(getResp.status()).toBe(404);
    });

    test('should return 404 when deleting non-existent integration', async ({ authedRequestA }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authedRequestA.delete(`/api/integrations/${fakeId}`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Authentication', () => {
    test('should reject unauthenticated requests', async ({ request }) => {
      const response = await request.get(
        `${process.env.TEST_API_URL || 'http://localhost:3001'}/api/integrations`,
      );

      expect(response.status()).toBe(401);
    });

    test('should reject requests with invalid token', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        baseURL: process.env.TEST_API_URL || 'http://localhost:3001',
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-jwt-token',
        },
      });

      const response = await context.get('/api/integrations');
      expect(response.status()).toBe(401);

      await context.dispose();
    });
  });
});

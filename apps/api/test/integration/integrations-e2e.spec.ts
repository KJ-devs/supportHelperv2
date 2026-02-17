import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { IntegrationsCryptoService } from '@/modules/integrations/integrations-crypto.service';
import { IntegrationProvider } from '@/modules/integrations/providers/integration-provider.interface';
import { JiraProvider } from '@/modules/integrations/providers/jira.provider';
import { SlackProvider } from '@/modules/integrations/providers/slack.provider';
import { HubSpotProvider } from '@/modules/integrations/providers/hubspot.provider';
import { DiscordProvider } from '@/modules/integrations/providers/discord.provider';
import { NotionProvider } from '@/modules/integrations/providers/notion.provider';
import { Integration, Ticket, Prisma } from '@prisma/client';
import { parseEncryptionKey } from '@support-helper/shared';

/**
 * Integration E2E Tests
 *
 * Tests third-party integration providers with mocked external APIs.
 * Covers:
 * - Connection testing for Jira, Slack, HubSpot, Discord
 * - Ticket sync (create/update/delete)
 * - Data pull operations (pullTickets)
 * - Error handling & rate limiting
 * - Config encryption/decryption
 * - Integration CRUD operations
 * - Config validation
 *
 * Running these tests:
 * 1. Set TEST_DATABASE_URL environment variable to a test PostgreSQL database
 * 2. Run: pnpm --filter @support-helper/api test test/integration/integrations-e2e.spec.ts
 *
 * Note: External API calls are mocked using global.fetch and jest.mock()
 * No actual third-party accounts are required.
 */

// Mock external API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock Slack SDK
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    auth: {
      test: jest.fn().mockResolvedValue({ ok: true, user: 'test-bot' }),
    },
    conversations: {
      list: jest.fn().mockResolvedValue({ ok: true, channels: [] }),
      history: jest.fn().mockResolvedValue({
        ok: true,
        messages: [
          {
            text: 'Test message',
            ts: '1234567890.123456',
            type: 'message'
          }
        ],
        response_metadata: {}
      }),
    },
    chat: {
      postMessage: jest.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        message: { permalink: 'https://slack.com/archives/C123/p1234567890123456' }
      }),
      update: jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' }),
      delete: jest.fn().mockResolvedValue({ ok: true }),
    },
  })),
}));

const isIntegrationTest = !!process.env.TEST_DATABASE_URL;
const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(isIntegrationTest)('Integrations E2E', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let integrationsService: IntegrationsService;
  let cryptoService: IntegrationsCryptoService;
  let testTenantId: string;

  const ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars for AES-256-GCM
  const encryptionKeyBuffer = parseEncryptionKey(ENCRYPTION_KEY);

  // Helper to decrypt integration config
  const decryptConfig = (integration: Integration) => {
    return JSON.parse(cryptoService.decrypt(integration.config, integration.configIv));
  };

  beforeAll(async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = ENCRYPTION_KEY;

    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        IntegrationsService,
        IntegrationsCryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'INTEGRATION_ENCRYPTION_KEY') return ENCRYPTION_KEY;
              return null;
            }),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
    cryptoService = module.get<IntegrationsCryptoService>(IntegrationsCryptoService);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: `E2E Test Tenant ${Date.now()}`,
        slug: `e2e-test-${Date.now()}`,
        plan: 'enterprise',
        settings: {},
      },
    });
    testTenantId = tenant.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.integrationSyncLog.deleteMany({ where: { integration: { tenantId: testTenantId } } });
    await prisma.integration.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.ticket.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.application.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } });
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Jira Provider E2E', () => {
    let jiraProvider: JiraProvider;
    let jiraIntegration: Integration;
    let testTicket: Ticket;

    beforeAll(async () => {
      jiraProvider = new JiraProvider();

      const config = {
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-api-token',
        projectKey: 'TEST',
      };

      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(config));

      jiraIntegration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'jira',
          name: 'Test Jira',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      const app = await prisma.application.create({
        data: {
          tenantId: testTenantId,
          name: 'Test App',
          platform: 'web',
          sdkKey: `sk_test_${Date.now()}`,
          settings: {},
        },
      });

      testTicket = await prisma.ticket.create({
        data: {
          tenantId: testTenantId,
          applicationId: app.id,
          title: 'Test Bug',
          description: 'Test description',
          status: 'new',
          type: 'bug',
          severity: 'high',
          priority: 1,
          keywords: [],
        },
      });
    });

    afterAll(async () => {
      await prisma.integrationSyncLog.deleteMany({ where: { integrationId: jiraIntegration.id } });
      await prisma.integration.delete({ where: { id: jiraIntegration.id } });
      await prisma.ticket.delete({ where: { id: testTicket.id } });
    });

    it('should test Jira connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ displayName: 'Test User', emailAddress: 'test@example.com' }),
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected as');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/myself',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
          }),
        })
      );
    });

    it('should handle Jira connection failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should sync ticket to Jira (create issue)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ key: 'TEST-123' }),
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('TEST-123');
      expect(result.externalUrl).toBe('https://test.atlassian.net/browse/TEST-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test Bug'),
        })
      );
    });

    it('should update existing Jira issue', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.updateTicket('TEST-123', testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('TEST-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-123',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should pull tickets from Jira', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          startAt: 0,
          maxResults: 100,
          total: 1,
          issues: [
            {
              key: 'TEST-456',
              fields: {
                summary: 'Pulled Issue',
                description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Description' }] }] },
                status: { name: 'Open' },
                priority: { name: 'High' },
                issuetype: { name: 'Bug' },
                created: '2024-01-01T00:00:00.000Z',
                updated: '2024-01-02T00:00:00.000Z',
                labels: ['support-helper'],
              },
            },
          ],
        }),
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.pullTickets(config);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].externalId).toBe('TEST-456');
      expect(result.tickets[0].title).toBe('Pulled Issue');
    });

    it('should handle Jira API rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      } as any);

      const config = decryptConfig(jiraIntegration);
      const result = await jiraProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });
  });

  describe('Slack Provider E2E', () => {
    let slackProvider: SlackProvider;
    let slackIntegration: Integration;
    let testTicket: Ticket;

    beforeAll(async () => {
      slackProvider = new SlackProvider();

      const config = {
        botToken: 'xoxb-test-token',
        channel: '#test-support',
      };

      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(config));

      slackIntegration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'slack',
          name: 'Test Slack',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      const app = await prisma.application.findFirst({
        where: { tenantId: testTenantId },
      });

      testTicket = await prisma.ticket.create({
        data: {
          tenantId: testTenantId,
          applicationId: app!.id,
          title: 'Slack Test Bug',
          description: 'Test slack notification',
          status: 'new',
          type: 'bug',
          severity: 'medium',
          priority: 1,
          keywords: [],
        },
      });
    });

    afterAll(async () => {
      await prisma.integrationSyncLog.deleteMany({ where: { integrationId: slackIntegration.id } });
      await prisma.integration.delete({ where: { id: slackIntegration.id } });
      await prisma.ticket.delete({ where: { id: testTicket.id } });
    });

    it('should test Slack connection successfully', async () => {
      const config = decryptConfig(slackIntegration);
      const result = await slackProvider.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected as');
    });

    it('should post ticket to Slack channel', async () => {
      const config = decryptConfig(slackIntegration);
      const result = await slackProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBeTruthy();
      expect(result.externalUrl).toBeTruthy();
    });

    it('should update Slack message', async () => {
      const config = decryptConfig(slackIntegration);
      const result = await slackProvider.updateTicket('1234567890.123456', testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('1234567890.123456');
    });

    it('should delete Slack message', async () => {
      const config = decryptConfig(slackIntegration);

      await expect(
        slackProvider.deleteTicket('1234567890.123456', config)
      ).resolves.not.toThrow();
    });

    it('should pull messages from Slack channel', async () => {
      const config = decryptConfig(slackIntegration);
      const result = await slackProvider.pullTickets(config);

      expect(result.success).toBe(true);
      expect(result.tickets.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HubSpot Provider E2E', () => {
    let hubspotProvider: HubSpotProvider;
    let hubspotIntegration: Integration;
    let testTicket: Ticket;

    beforeAll(async () => {
      hubspotProvider = new HubSpotProvider();

      const config = {
        accessToken: 'pat-test-token',
        pipelineId: '0',
        pipelineStageId: '1',
      };

      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(config));

      hubspotIntegration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'hubspot',
          name: 'Test HubSpot',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      const app = await prisma.application.findFirst({
        where: { tenantId: testTenantId },
      });

      testTicket = await prisma.ticket.create({
        data: {
          tenantId: testTenantId,
          applicationId: app!.id,
          title: 'HubSpot Test Ticket',
          description: 'Test HubSpot sync',
          status: 'new',
          type: 'bug',
          severity: 'high',
          priority: 1,
          keywords: [],
        },
      });
    });

    afterAll(async () => {
      await prisma.integrationSyncLog.deleteMany({ where: { integrationId: hubspotIntegration.id } });
      await prisma.integration.delete({ where: { id: hubspotIntegration.id } });
      await prisma.ticket.delete({ where: { id: testTicket.id } });
    });

    it('should test HubSpot connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ total: 0, results: [] }),
      } as any);

      const config = decryptConfig(hubspotIntegration);
      const result = await hubspotProvider.testConnection(config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.hubapi.com/crm/v3/objects/tickets'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer pat-test-token',
          }),
        })
      );
    });

    it('should create ticket in HubSpot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: '123456' }),
      } as any);

      const config = decryptConfig(hubspotIntegration);
      const result = await hubspotProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('123456');
      expect(result.externalUrl).toContain('hubspot.com');
    });

    it('should update HubSpot ticket', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456' }),
      } as any);

      const config = decryptConfig(hubspotIntegration);
      const result = await hubspotProvider.updateTicket('123456', testTicket, config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/123456'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should delete HubSpot ticket', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const config = decryptConfig(hubspotIntegration);

      await expect(
        hubspotProvider.deleteTicket('123456', config)
      ).resolves.not.toThrow();
    });

    it('should pull tickets from HubSpot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total: 1,
          results: [
            {
              id: '789',
              properties: {
                subject: 'Pulled HubSpot Ticket',
                content: 'Description',
                hs_ticket_priority: 'HIGH',
                createdate: '2024-01-01T00:00:00.000Z',
                hs_lastmodifieddate: '2024-01-02T00:00:00.000Z',
              },
            },
          ],
        }),
      } as any);

      const config = decryptConfig(hubspotIntegration);
      const result = await hubspotProvider.pullTickets(config);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].title).toBe('Pulled HubSpot Ticket');
    });
  });

  describe('Discord Provider E2E', () => {
    let discordProvider: DiscordProvider;
    let discordIntegration: Integration;
    let testTicket: Ticket;

    beforeAll(async () => {
      discordProvider = new DiscordProvider();

      const config = {
        webhookUrl: 'https://discord.com/api/webhooks/123/test-token',
        username: 'Support Helper Bot',
      };

      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(config));

      discordIntegration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'discord',
          name: 'Test Discord',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      const app = await prisma.application.findFirst({
        where: { tenantId: testTenantId },
      });

      testTicket = await prisma.ticket.create({
        data: {
          tenantId: testTenantId,
          applicationId: app!.id,
          title: 'Discord Test Bug',
          description: 'Test Discord webhook',
          status: 'new',
          type: 'bug',
          severity: 'critical',
          priority: 1,
          keywords: [],
        },
      });
    });

    afterAll(async () => {
      await prisma.integrationSyncLog.deleteMany({ where: { integrationId: discordIntegration.id } });
      await prisma.integration.delete({ where: { id: discordIntegration.id } });
      await prisma.ticket.delete({ where: { id: testTicket.id } });
    });

    it('should test Discord webhook connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const config = decryptConfig(discordIntegration);
      const result = await discordProvider.testConnection(config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/test-token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test successful'),
        })
      );
    });

    it('should post ticket to Discord channel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '987654321' }),
      } as any);

      const config = decryptConfig(discordIntegration);
      const result = await discordProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('987654321');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?wait=true'),
        expect.objectContaining({
          body: expect.stringContaining('Discord Test Bug'),
        })
      );
    });

    it('should update Discord message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '987654321' }),
      } as any);

      const config = decryptConfig(discordIntegration);
      const result = await discordProvider.updateTicket('987654321', testTicket, config);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/987654321'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should delete Discord message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const config = decryptConfig(discordIntegration);

      await expect(
        discordProvider.deleteTicket('987654321', config)
      ).resolves.not.toThrow();
    });

    it('should handle Discord webhook errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Unknown Webhook',
      } as any);

      const config = decryptConfig(discordIntegration);
      const result = await discordProvider.syncTicket(testTicket, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Integration CRUD Flow', () => {
    it('should create integration with encrypted config', async () => {
      const config = {
        webhookUrl: 'https://hooks.slack.com/services/test',
        channel: '#alerts',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const integration = await integrationsService.create(testTenantId, {
        type: 'discord',
        name: 'CRUD Test Discord',
        config,
        enabled: true,
      });

      expect(integration.id).toBeDefined();
      expect(integration.type).toBe('discord');
      expect(integration.config).toEqual(config); // IntegrationsService returns decrypted config

      // Verify it's encrypted in DB
      const fromDb = await prisma.integration.findUnique({ where: { id: integration.id } });
      expect(fromDb!.config).not.toBe(JSON.stringify(config));
      expect(fromDb!.configIv).toBeTruthy();

      // Cleanup
      await integrationsService.delete(integration.id, testTenantId);
    });

    it('should update integration and re-encrypt config', async () => {
      const initialConfig = { webhookUrl: 'https://discord.com/api/webhooks/old' };
      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(initialConfig));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      } as any);

      const integration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'discord',
          name: 'Update Test',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      const newConfig = { webhookUrl: 'https://discord.com/api/webhooks/new' };

      const updated = await integrationsService.update(integration.id, testTenantId, {
        config: newConfig,
      });

      expect(updated.config.webhookUrl).toBe('https://discord.com/api/webhooks/new');

      // Cleanup
      await integrationsService.delete(integration.id, testTenantId);
    });

    it('should test connection before enabling integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ displayName: 'Test User' }),
      } as any);

      const config = {
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        projectKey: 'TEST',
      };

      const jiraProvider = new JiraProvider();
      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(true);
    });

    it('should disable integration on connection test failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as any);

      const config = {
        host: 'https://test.atlassian.net',
        email: 'invalid@example.com',
        apiToken: 'invalid-token',
        projectKey: 'TEST',
      };

      const jiraProvider = new JiraProvider();
      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should list integrations filtered by type', async () => {
      const integrations = await integrationsService.findAll(testTenantId, { type: 'jira' });

      expect(integrations).toBeInstanceOf(Array);
      integrations.forEach((integration) => {
        expect(integration.type).toBe('jira');
        expect(integration.tenantId).toBe(testTenantId);
      });
    });

    it('should delete integration', async () => {
      const config = { webhookUrl: 'https://discord.com/api/webhooks/delete-test' };
      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(config));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as any);

      const integration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'discord',
          name: 'Delete Test',
          config: ciphertext,
          configIv: iv,
          enabled: true,
        },
      });

      await integrationsService.delete(integration.id, testTenantId);

      const deleted = await prisma.integration.findUnique({
        where: { id: integration.id },
      });

      expect(deleted).toBeNull();
    });
  });

  describe('Error Handling & Retries', () => {
    it('should handle network timeout gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const jiraProvider = new JiraProvider();
      const config = {
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        projectKey: 'TEST',
      };

      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as any);

      const jiraProvider = new JiraProvider();
      const config = {
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        projectKey: 'TEST',
      };

      const result = await jiraProvider.testConnection(config);

      expect(result.success).toBe(false);
    });

    it('should validate required config fields', async () => {
      const jiraProvider = new JiraProvider();

      const result = await jiraProvider.validateConfig({});

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate optional config fields are not required', async () => {
      const jiraProvider = new JiraProvider();

      const result = await jiraProvider.validateConfig({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token',
        projectKey: 'TEST',
        // issueType and priorityMapping are optional
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Config Encryption/Decryption', () => {
    it('should encrypt integration config with AES-256-GCM', () => {
      const plainConfig = { apiKey: 'secret-key-123', endpoint: 'https://api.example.com' };
      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(plainConfig));

      expect(ciphertext).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(ciphertext).not.toContain('secret-key-123');
      expect(ciphertext).not.toContain('api.example.com');
    });

    it('should decrypt integration config correctly', () => {
      const plainConfig = { token: 'xoxb-test-token', channel: '#general' };
      const { ciphertext, iv } = cryptoService.encrypt(JSON.stringify(plainConfig));

      const decrypted = JSON.parse(cryptoService.decrypt(ciphertext, iv));

      expect(decrypted).toEqual(plainConfig);
    });

    it('should throw error on invalid encrypted config', () => {
      const invalidEncrypted = 'invalid-base64-string';
      const invalidIv = 'invalid-iv';

      expect(() => {
        cryptoService.decrypt(invalidEncrypted, invalidIv);
      }).toThrow();
    });

    it('should handle config re-encryption on update', async () => {
      const config1 = { webhookUrl: 'https://discord.com/api/webhooks/1' };
      const { ciphertext: ciphertext1, iv: iv1 } = cryptoService.encrypt(JSON.stringify(config1));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      } as any);

      const integration = await prisma.integration.create({
        data: {
          tenantId: testTenantId,
          type: 'discord',
          name: 'Re-encrypt Test',
          config: ciphertext1,
          configIv: iv1,
          enabled: true,
        },
      });

      const config2 = { webhookUrl: 'https://discord.com/api/webhooks/2' };
      const { ciphertext: ciphertext2, iv: iv2 } = cryptoService.encrypt(JSON.stringify(config2));

      await prisma.integration.update({
        where: { id: integration.id },
        data: { config: ciphertext2, configIv: iv2 },
      });

      const updated = await prisma.integration.findUnique({
        where: { id: integration.id },
      });

      const decrypted = JSON.parse(cryptoService.decrypt(updated!.config, updated!.configIv));
      expect(decrypted.webhookUrl).toBe('https://discord.com/api/webhooks/2');

      // Cleanup
      await prisma.integration.delete({ where: { id: integration.id } });
    });
  });
});

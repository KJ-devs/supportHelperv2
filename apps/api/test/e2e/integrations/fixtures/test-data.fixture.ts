/**
 * Test data fixtures for integration E2E tests.
 * Provides valid and invalid configs for each provider type.
 */

export const JIRA_CONFIG = {
  valid: {
    host: 'https://test-team.atlassian.net',
    email: 'admin@test-team.com',
    apiToken: 'jira-api-token-abc123',
    projectKey: 'SUP',
  },
  withOptional: {
    host: 'https://test-team.atlassian.net',
    email: 'admin@test-team.com',
    apiToken: 'jira-api-token-abc123',
    projectKey: 'SUP',
    issueType: 'Task',
    priorityMapping: '{"critical":"Blocker","high":"Major"}',
  },
  missingRequired: {
    host: 'https://test-team.atlassian.net',
    // email, apiToken, projectKey missing
  },
};

export const SLACK_CONFIG = {
  valid: {
    botToken: 'xoxb-test-slack-bot-token-123',
    channel: '#support-bugs',
  },
  missingRequired: {
    botToken: 'xoxb-test-slack-bot-token-123',
    // channel missing
  },
};

export const HUBSPOT_CONFIG = {
  valid: {
    accessToken: 'pat-na1-test-hubspot-token',
    pipelineId: '0',
    pipelineStageId: '1',
  },
  withOptional: {
    accessToken: 'pat-na1-test-hubspot-token',
    pipelineId: '0',
    pipelineStageId: '1',
    ownerId: '12345',
    ticketPriority: 'MEDIUM',
  },
  missingRequired: {
    accessToken: 'pat-na1-test-hubspot-token',
    // pipelineId, pipelineStageId missing
  },
};

export const NOTION_CONFIG = {
  valid: {
    apiToken: 'secret_notion_test_token_abc',
    databaseId: 'aaaabbbbccccdddd1111222233334444',
  },
  missingRequired: {
    // apiToken, databaseId missing
  },
};

export const DISCORD_CONFIG = {
  valid: {
    webhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdef-webhook-token',
  },
  withOptional: {
    webhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdef-webhook-token',
    username: 'E2E Test Bot',
    avatarUrl: 'https://example.com/avatar.png',
  },
  missingRequired: {
    // webhookUrl missing
  },
};

/**
 * Integration create payloads for each provider.
 */
export function createIntegrationPayload(
  type: string,
  name: string,
  config: Record<string, unknown>,
  options?: { enabled?: boolean; mappings?: Record<string, unknown> },
): Record<string, unknown> {
  return {
    type,
    name,
    config,
    enabled: options?.enabled ?? true,
    ...(options?.mappings ? { mappings: options.mappings } : {}),
  };
}

/**
 * Standard integration payloads ready for create API calls.
 */
export const INTEGRATIONS = {
  jira: () => createIntegrationPayload('jira', 'E2E Jira Integration', JIRA_CONFIG.valid),
  slack: () => createIntegrationPayload('slack', 'E2E Slack Integration', SLACK_CONFIG.valid),
  hubspot: () => createIntegrationPayload('hubspot', 'E2E HubSpot Integration', HUBSPOT_CONFIG.valid),
  notion: () => createIntegrationPayload('notion', 'E2E Notion Integration', NOTION_CONFIG.valid),
  discord: () => createIntegrationPayload('discord', 'E2E Discord Integration', DISCORD_CONFIG.valid),
};

import { Ticket } from '@prisma/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, ConfigField } from '../types/integration.types';

export class JiraProvider extends BaseIntegrationProvider {
  readonly type = 'jira';
  readonly name = 'Jira';
  readonly description = 'Sync tickets to Jira issues';
  readonly requiredConfig: ConfigField[] = [
    {
      key: 'host',
      label: 'Jira URL',
      type: 'url',
      description: 'Your Jira instance URL (e.g., https://yourteam.atlassian.net)',
      placeholder: 'https://yourteam.atlassian.net',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'string',
      description: 'Jira account email for API authentication',
      placeholder: 'user@example.com',
    },
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      description: 'Jira API token (generate at id.atlassian.net/manage-profile/security/api-tokens)',
      placeholder: 'Your Jira API token',
    },
    {
      key: 'projectKey',
      label: 'Project Key',
      type: 'string',
      description: 'Jira project key (e.g., SUP)',
      placeholder: 'SUP',
    },
  ];
  readonly optionalConfig: ConfigField[] = [
    {
      key: 'issueType',
      label: 'Issue Type',
      type: 'string',
      description: 'Jira issue type name (default: Bug)',
      placeholder: 'Bug',
    },
    {
      key: 'priorityMapping',
      label: 'Priority Mapping',
      type: 'string',
      description: 'JSON mapping of severity to Jira priority names',
      placeholder: '{"critical":"Highest","high":"High","medium":"Medium","low":"Low"}',
    },
  ];

  private getAuthHeader(config: IntegrationConfig): string {
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private getBaseUrl(config: IntegrationConfig): string {
    return config.host.replace(/\/+$/, '');
  }

  private getPriorityMapping(config: IntegrationConfig): Record<string, string> {
    const defaultMapping: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    if (config.priorityMapping) {
      try {
        const parsed = typeof config.priorityMapping === 'string'
          ? JSON.parse(config.priorityMapping)
          : config.priorityMapping;
        return { ...defaultMapping, ...parsed };
      } catch {
        return defaultMapping;
      }
    }

    return defaultMapping;
  }

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(config),
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const user = await response.json() as { displayName?: string; emailAddress?: string };

      return {
        success: true,
        message: `Connected as ${user.displayName || user.emailAddress}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Jira',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const priorityMapping = this.getPriorityMapping(config);
      const issueType = config.issueType || 'Bug';

      const descriptionParts: string[] = [];

      if (ticket.description) {
        descriptionParts.push(ticket.description);
      }

      if (ticket.aiSummary) {
        descriptionParts.push(`\n--- AI Summary ---\n${ticket.aiSummary}`);
      }

      if ((ticket as any).aiAnalysis) {
        descriptionParts.push(`\n--- AI Analysis ---\n${(ticket as any).aiAnalysis}`);
      }

      descriptionParts.push(`\n--- Ticket Info ---`);
      descriptionParts.push(`Ticket ID: ${ticket.id}`);
      descriptionParts.push(`Status: ${ticket.status || 'new'}`);
      descriptionParts.push(`Severity: ${ticket.severity || 'unknown'}`);
      descriptionParts.push(`Type: ${ticket.type || 'unknown'}`);

      const description = descriptionParts.join('\n');

      const labels = ['support-helper'];
      if (ticket.severity) labels.push(ticket.severity);
      if (ticket.type) labels.push(ticket.type);

      const issuePayload: any = {
        fields: {
          project: {
            key: config.projectKey,
          },
          summary: ticket.title || 'Untitled Ticket',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: description,
                  },
                ],
              },
            ],
          },
          issuetype: {
            name: issueType,
          },
          labels,
        },
      };

      const severity = ticket.severity?.toLowerCase();
      if (severity && priorityMapping[severity]) {
        issuePayload.fields.priority = {
          name: priorityMapping[severity],
        };
      }

      const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(config),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(issuePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const issue = await response.json() as { key: string };

      return {
        success: true,
        externalId: issue.key,
        externalUrl: `${baseUrl}/browse/${issue.key}`,
        message: `Issue ${issue.key} created in Jira`,
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const priorityMapping = this.getPriorityMapping(config);

      const descriptionParts: string[] = [];

      if (ticket.description) {
        descriptionParts.push(ticket.description);
      }

      if (ticket.aiSummary) {
        descriptionParts.push(`\n--- AI Summary ---\n${ticket.aiSummary}`);
      }

      if ((ticket as any).aiAnalysis) {
        descriptionParts.push(`\n--- AI Analysis ---\n${(ticket as any).aiAnalysis}`);
      }

      descriptionParts.push(`\n--- Ticket Info ---`);
      descriptionParts.push(`Ticket ID: ${ticket.id}`);
      descriptionParts.push(`Status: ${ticket.status || 'new'}`);
      descriptionParts.push(`Severity: ${ticket.severity || 'unknown'}`);
      descriptionParts.push(`Type: ${ticket.type || 'unknown'}`);

      const description = descriptionParts.join('\n');

      const labels = ['support-helper'];
      if (ticket.severity) labels.push(ticket.severity);
      if (ticket.type) labels.push(ticket.type);

      const updatePayload: any = {
        fields: {
          summary: ticket.title || 'Untitled Ticket',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: description,
                  },
                ],
              },
            ],
          },
          labels,
        },
      };

      const severity = ticket.severity?.toLowerCase();
      if (severity && priorityMapping[severity]) {
        updatePayload.fields.priority = {
          name: priorityMapping[severity],
        };
      }

      const response = await fetch(`${baseUrl}/rest/api/3/issue/${externalId}`, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(config),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      return {
        success: true,
        externalId,
        externalUrl: `${baseUrl}/browse/${externalId}`,
        message: `Issue ${externalId} updated in Jira`,
      };
    } catch (error) {
      return this.handleApiError(error, 'updateTicket');
    }
  }

  async deleteTicket(externalId: string, config: IntegrationConfig): Promise<void> {
    this.logger.log(`Jira deleteTicket called for ${externalId} - returning success (no deletion)`);
  }
}

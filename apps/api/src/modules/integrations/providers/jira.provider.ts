import { Ticket } from '@prisma/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, PullResult, PulledTicket, ConfigField } from '../types/integration.types';
import { getErrorMessage } from '../../../common/utils/error.utils';

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
        error: getErrorMessage(error) || 'Failed to connect to Jira',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
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

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
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

  async deleteTicket(externalId: string, _config: IntegrationConfig): Promise<void> {
    this.logger.log(`Jira deleteTicket called for ${externalId} - returning success (no deletion)`);
  }

  async pullTickets(config: IntegrationConfig, options?: { startAt?: number; maxResults?: number }): Promise<PullResult> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const projectKey = config.projectKey;
      const maxResults = options?.maxResults || 100;
      const allTickets: PulledTicket[] = [];
      let startAt = options?.startAt || 0;
      let total = 0;

      do {
        const jql = encodeURIComponent(`project = ${projectKey} ORDER BY created DESC`);
        const url = `${baseUrl}/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,description,status,priority,issuetype,created,updated,labels`;

        const response = await fetch(url, {
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

        const data = await response.json() as {
          startAt: number;
          maxResults: number;
          total: number;
          issues: Array<{
            key: string;
            fields: {
              summary: string;
              description?: any;
              status?: { name: string };
              priority?: { name: string };
              issuetype?: { name: string };
              created: string;
              updated: string;
              labels?: string[];
            };
          }>;
        };

        total = data.total;

        for (const issue of data.issues) {
          const description = this.extractTextFromAdf(issue.fields.description);

          allTickets.push({
            externalId: issue.key,
            externalUrl: `${baseUrl}/browse/${issue.key}`,
            title: issue.fields.summary,
            description,
            status: issue.fields.status?.name?.toLowerCase(),
            severity: this.mapJiraPriorityToSeverity(issue.fields.priority?.name),
            type: issue.fields.issuetype?.name?.toLowerCase() || 'bug',
            createdAt: issue.fields.created,
            updatedAt: issue.fields.updated,
            metadata: {
              labels: issue.fields.labels,
              jiraStatus: issue.fields.status?.name,
              jiraPriority: issue.fields.priority?.name,
              jiraIssueType: issue.fields.issuetype?.name,
            },
          });
        }

        startAt += data.issues.length;
      } while (startAt < total);

      this.logger.log(`Pulled ${allTickets.length}/${total} issues from Jira project ${projectKey}`);

      return { success: true, tickets: allTickets, total };
    } catch (error) {
      this.logger.error(`pullTickets failed: ${getErrorMessage(error)}`);
      return { success: false, tickets: [], total: 0, error: getErrorMessage(error) };
    }
  }

  private extractTextFromAdf(adfNode: any): string {
    if (!adfNode) return '';
    if (typeof adfNode === 'string') return adfNode;
    if (adfNode.type === 'text') return adfNode.text || '';
    if (adfNode.content && Array.isArray(adfNode.content)) {
      return adfNode.content.map((child: any) => this.extractTextFromAdf(child)).join('\n');
    }
    return '';
  }

  private mapJiraPriorityToSeverity(priority?: string): string {
    if (!priority) return 'medium';
    const map: Record<string, string> = {
      'Highest': 'critical',
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'Lowest': 'low',
    };
    return map[priority] || 'medium';
  }
}

import { Ticket } from '@prisma/client';
import { Client } from '@notionhq/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, ConfigField } from '../types/integration.types';

export class NotionProvider extends BaseIntegrationProvider {
  readonly type = 'notion';
  readonly name = 'Notion';
  readonly description = 'Create pages in Notion database for tickets';
  readonly requiredConfig: ConfigField[] = [
    {
      key: 'apiToken',
      label: 'Integration Token',
      type: 'password',
      description: 'Notion Integration Secret',
      placeholder: 'secret_...',
    },
    {
      key: 'databaseId',
      label: 'Database ID',
      type: 'string',
      description: 'Notion database ID',
      placeholder: '32-character database ID',
    },
  ];
  readonly optionalConfig: ConfigField[] = [];

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const notion = new Client({ auth: config.apiToken });

      const database = await notion.databases.retrieve({
        database_id: config.databaseId,
      });

      const dbTitle = (database as any).title?.[0]?.plain_text || 'Untitled';

      return {
        success: true,
        message: `Connected to database: ${dbTitle}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Notion',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const notion = new Client({ auth: config.apiToken });

      const properties: any = {
        Name: {
          title: [
            {
              text: {
                content: ticket.title || 'Untitled Ticket',
              },
            },
          ],
        },
      };

      if (ticket.status) {
        properties.Status = {
          select: {
            name: ticket.status,
          },
        };
      }

      if (ticket.severity) {
        properties.Severity = {
          select: {
            name: ticket.severity,
          },
        };
      }

      if (ticket.type) {
        properties.Type = {
          select: {
            name: ticket.type,
          },
        };
      }

      const children: any[] = [];

      if (ticket.description) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: ticket.description.substring(0, 2000),
                },
              },
            ],
          },
        });
      }

      if (ticket.aiSummary) {
        children.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'AI Summary',
                },
              },
            ],
          },
        });

        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: ticket.aiSummary.substring(0, 2000),
                },
              },
            ],
          },
        });
      }

      const page = await notion.pages.create({
        parent: { database_id: config.databaseId },
        properties,
        children: children.length > 0 ? children : undefined,
      });

      return {
        success: true,
        externalId: page.id,
        externalUrl: (page as any).url,
        message: 'Page created in Notion',
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const notion = new Client({ auth: config.apiToken });

      const properties: any = {
        Name: {
          title: [
            {
              text: {
                content: ticket.title || 'Untitled Ticket',
              },
            },
          ],
        },
      };

      if (ticket.status) {
        properties.Status = {
          select: {
            name: ticket.status,
          },
        };
      }

      if (ticket.severity) {
        properties.Severity = {
          select: {
            name: ticket.severity,
          },
        };
      }

      if (ticket.type) {
        properties.Type = {
          select: {
            name: ticket.type,
          },
        };
      }

      const page = await notion.pages.update({
        page_id: externalId,
        properties,
      });

      return {
        success: true,
        externalId: page.id,
        externalUrl: (page as any).url,
        message: 'Page updated in Notion',
      };
    } catch (error) {
      return this.handleApiError(error, 'updateTicket');
    }
  }
}

import { Ticket } from '@prisma/client';
import { Client } from '@notionhq/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, PullResult, PulledTicket, ConfigField } from '../types/integration.types';
import { getErrorMessage } from '../../../common/utils/error.utils';

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

      const dbTitle = (database as { title?: Array<{ plain_text?: string }> }).title?.[0]?.plain_text || 'Untitled';

      return {
        success: true,
        message: `Connected to database: ${dbTitle}`,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to connect to Notion',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
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
        externalUrl: (page as { url?: string }).url,
        message: 'Page created in Notion',
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
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
        externalUrl: (page as { url?: string }).url,
        message: 'Page updated in Notion',
      };
    } catch (error) {
      return this.handleApiError(error, 'updateTicket');
    }
  }

  async deleteTicket(externalId: string, config: IntegrationConfig): Promise<void> {
    const notion = new Client({ auth: config.apiToken });
    await notion.pages.update({
      page_id: externalId,
      archived: true,
    });
  }

  async pullTickets(config: IntegrationConfig, options?: { startAt?: number; maxResults?: number }): Promise<PullResult> {
    try {
      const notion = new Client({ auth: config.apiToken });
      const maxResults = options?.maxResults || 100;
      const allTickets: PulledTicket[] = [];
      let startCursor: string | undefined;
      let hasMore = true;

      while (hasMore && allTickets.length < maxResults) {
        const pageSize = Math.min(maxResults - allTickets.length, 100);

        const response = await notion.databases.query({
          database_id: config.databaseId,
          start_cursor: startCursor,
          page_size: pageSize,
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        });

        for (const page of response.results) {
          type NotionPage = {
            id: string;
            url?: string;
            created_time?: string;
            last_edited_time?: string;
            properties?: Record<string, {
              title?: Array<{ plain_text?: string }>;
              select?: { name?: string };
            }>;
          };
          const p = page as NotionPage;
          const props = p.properties || {};

          const title = props.Name?.title?.[0]?.plain_text || 'Untitled';
          const status = props.Status?.select?.name;
          const severity = props.Severity?.select?.name;
          const type = props.Type?.select?.name;

          let description = '';
          try {
            const blocks = await notion.blocks.children.list({
              block_id: p.id,
              page_size: 3,
            });
            description = blocks.results
              .filter((b: any) => b.type === 'paragraph')
              .map((b: any) => {
                const richText = b.paragraph?.rich_text || [];
                return richText.map((t: any) => t.plain_text || '').join('');
              })
              .join('\n')
              .trim();
          } catch {
            // Page content not accessible - skip description
          }

          allTickets.push({
            externalId: p.id,
            externalUrl: p.url,
            title,
            description: description || undefined,
            status: status?.toLowerCase(),
            severity: severity?.toLowerCase(),
            type: type?.toLowerCase(),
            createdAt: p.created_time,
            updatedAt: p.last_edited_time,
            metadata: {
              notionStatus: status,
              notionSeverity: severity,
              notionType: type,
              parentDatabaseId: config.databaseId,
            },
          });
        }

        hasMore = response.has_more;
        startCursor = response.next_cursor ?? undefined;
      }

      this.logger.log(`Pulled ${allTickets.length} pages from Notion database ${config.databaseId}`);

      return { success: true, tickets: allTickets, total: allTickets.length };
    } catch (error) {
      this.logger.error(`pullTickets failed: ${getErrorMessage(error)}`);
      return { success: false, tickets: [], total: 0, error: getErrorMessage(error) };
    }
  }
}

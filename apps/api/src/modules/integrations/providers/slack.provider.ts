import { Ticket } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, PullResult, PulledTicket, ConfigField } from '../types/integration.types';
import { getErrorMessage } from '../../../common/utils/error.utils';

export class SlackProvider extends BaseIntegrationProvider {
  readonly type = 'slack';
  readonly name = 'Slack';
  readonly description = 'Send ticket notifications to Slack channels';
  readonly requiredConfig: ConfigField[] = [
    {
      key: 'botToken',
      label: 'Bot Token',
      type: 'password',
      description: 'Slack Bot User OAuth Token (xoxb-...)',
      placeholder: 'xoxb-your-bot-token',
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'string',
      description: 'Channel name or ID (e.g., #support)',
      placeholder: '#support',
    },
  ];
  readonly optionalConfig: ConfigField[] = [];

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const client = new WebClient(config.botToken);

      const authTest = await client.auth.test();

      if (!authTest.ok) {
        throw new Error('Authentication failed');
      }

      await client.conversations.list({
        types: 'public_channel,private_channel',
      });

      return {
        success: true,
        message: `Connected as ${authTest.user}`,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to connect to Slack',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const client = new WebClient(config.botToken);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🐛 ${ticket.title || 'New Bug Report'}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${ticket.severity || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Type:*\n${ticket.type || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${ticket.status || 'new'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Ticket ID:*\n${ticket.id.substring(0, 8)}`,
            },
          ],
        },
      ];

      if (ticket.description) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${ticket.description.substring(0, 3000)}`,
          },
        });
      }

      if (ticket.aiSummary) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*AI Summary:*\n${ticket.aiSummary.substring(0, 3000)}`,
          },
        });
      }

      const result = await client.chat.postMessage({
        channel: config.channel,
        blocks,
        text: `New ticket: ${ticket.title || 'Bug Report'}`,
      });

      if (!result.ok) {
        throw new Error('Failed to post message to Slack');
      }

      return {
        success: true,
        externalId: result.ts,
        externalUrl: (result.message as { permalink?: string } | undefined)?.permalink,
        message: 'Ticket posted to Slack',
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, _mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const client = new WebClient(config.botToken);

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🐛 ${ticket.title || 'Bug Report'} (Updated)`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${ticket.severity || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Type:*\n${ticket.type || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${ticket.status || 'new'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Ticket ID:*\n${ticket.id.substring(0, 8)}`,
            },
          ],
        },
      ];

      const result = await client.chat.update({
        channel: config.channel,
        ts: externalId,
        blocks,
        text: `Updated ticket: ${ticket.title || 'Bug Report'}`,
      });

      if (!result.ok) {
        throw new Error('Failed to update message in Slack');
      }

      return {
        success: true,
        externalId: result.ts,
        message: 'Ticket updated in Slack',
      };
    } catch (error) {
      return this.handleApiError(error, 'updateTicket');
    }
  }

  async deleteTicket(externalId: string, config: IntegrationConfig): Promise<void> {
    const client = new WebClient(config.botToken);
    const result = await client.chat.delete({
      channel: config.channel,
      ts: externalId,
    });
    if (!result.ok) {
      throw new Error('Failed to delete message from Slack');
    }
  }

  /**
   * Pull messages from a Slack channel and convert them to tickets.
   *
   * Requires the bot to have `channels:history` (public channels)
   * or `groups:history` (private channels) OAuth scope.
   *
   * Uses cursor-based pagination. Limited to 200 messages max to
   * avoid excessive API calls.
   */
  async pullTickets(config: IntegrationConfig, options?: { startAt?: number; maxResults?: number }): Promise<PullResult> {
    try {
      const client = new WebClient(config.botToken);
      const maxMessages = Math.min(options?.maxResults || 200, 200);
      const allTickets: PulledTicket[] = [];
      let cursor: string | undefined;
      let total = 0;

      do {
        const batchSize = Math.min(100, maxMessages - allTickets.length);

        const response = await client.conversations.history({
          channel: config.channel,
          limit: batchSize,
          ...(cursor ? { cursor } : {}),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch channel history from Slack');
        }

        const messages = response.messages || [];

        for (const message of messages) {
          // Skip bot messages and system messages (join/leave/etc.)
          if (message.bot_id || message.subtype) {
            continue;
          }

          const text = message.text || '';
          if (!text.trim()) continue;

          const firstLine = text.split('\n')[0] ?? '';
          const title = firstLine.length > 200 ? firstLine.substring(0, 200) : firstLine;
          const ts = message.ts || '';

          allTickets.push({
            externalId: ts,
            title,
            description: text,
            status: 'open',
            severity: 'medium',
            type: 'bug',
            createdAt: ts ? new Date(parseFloat(ts) * 1000).toISOString() : undefined,
            metadata: {
              source: 'slack-message',
              channel: config.channel,
              threadTs: message.thread_ts,
              replyCount: message.reply_count,
            },
          });
        }

        cursor = response.response_metadata?.next_cursor || undefined;
        total = allTickets.length;
      } while (cursor && allTickets.length < maxMessages);

      this.logger.log(`Pulled ${allTickets.length} messages from Slack channel ${config.channel}`);

      return { success: true, tickets: allTickets, total };
    } catch (error) {
      this.logger.error(`pullTickets failed: ${getErrorMessage(error)}`);
      return { success: false, tickets: [], total: 0, error: getErrorMessage(error) };
    }
  }
}

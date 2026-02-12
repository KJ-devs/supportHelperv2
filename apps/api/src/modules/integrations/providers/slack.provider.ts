import { Ticket } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, ConfigField } from '../types/integration.types';
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
        externalUrl: (result.message as any)?.permalink,
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
}

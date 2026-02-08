import { Ticket } from '@prisma/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, ConfigField } from '../types/integration.types';

export class DiscordProvider extends BaseIntegrationProvider {
  readonly type = 'discord';
  readonly name = 'Discord';
  readonly description = 'Send ticket notifications to Discord via webhooks';
  readonly requiredConfig: ConfigField[] = [
    {
      key: 'webhookUrl',
      label: 'Webhook URL',
      type: 'url',
      description: 'Discord webhook URL from channel settings',
      placeholder: 'https://discord.com/api/webhooks/...',
    },
  ];
  readonly optionalConfig: ConfigField[] = [
    {
      key: 'username',
      label: 'Bot Username',
      type: 'string',
      description: 'Custom username for the webhook',
      placeholder: 'Support Helper',
    },
    {
      key: 'avatarUrl',
      label: 'Bot Avatar URL',
      type: 'url',
      description: 'Custom avatar image URL',
    },
  ];

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '✅ Discord integration test successful!',
          username: config.username || 'Support Helper',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      }

      return {
        success: true,
        message: 'Successfully connected to Discord webhook',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to connect to Discord',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const severityColor = this.getSeverityColor(ticket.severity);

      const embed = {
        title: `🐛 ${ticket.title || 'New Bug Report'}`,
        description: ticket.description || 'No description provided',
        color: severityColor,
        fields: [
          {
            name: 'Severity',
            value: ticket.severity || 'Unknown',
            inline: true,
          },
          {
            name: 'Type',
            value: ticket.type || 'Unknown',
            inline: true,
          },
          {
            name: 'Status',
            value: ticket.status || 'new',
            inline: true,
          },
        ],
        footer: {
          text: `Ticket ID: ${ticket.id}`,
        },
        timestamp: ticket.createdAt.toISOString(),
      };

      if (ticket.aiSummary) {
        embed.fields.push({
          name: 'AI Summary',
          value: ticket.aiSummary.substring(0, 1024),
          inline: false,
        });
      }

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: config.username || 'Support Helper',
          avatar_url: config.avatarUrl,
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      }

      const messageId = response.headers.get('x-message-id');

      return {
        success: true,
        externalId: messageId || undefined,
        message: 'Ticket posted to Discord',
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    return this.syncTicket(ticket, config, mappings);
  }

  private getSeverityColor(severity: string | null): number {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 0xff0000;
      case 'high':
        return 0xff6600;
      case 'medium':
        return 0xffcc00;
      case 'low':
        return 0x00ccff;
      default:
        return 0x999999;
    }
  }
}

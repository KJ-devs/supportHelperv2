import { Ticket } from '@prisma/client';
import { BaseIntegrationProvider } from './base-provider.abstract';
import { IntegrationConfig, SyncResult, ConfigField } from '../types/integration.types';

export class HubSpotProvider extends BaseIntegrationProvider {
  readonly type = 'hubspot';
  readonly name = 'HubSpot';
  readonly description = 'Sync tickets to HubSpot CRM';
  readonly requiredConfig: ConfigField[] = [
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      description: 'HubSpot Private App access token',
      placeholder: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    },
    {
      key: 'pipelineId',
      label: 'Pipeline ID',
      type: 'string',
      description: 'HubSpot ticket pipeline ID',
      placeholder: '0',
    },
    {
      key: 'pipelineStageId',
      label: 'Pipeline Stage ID',
      type: 'string',
      description: 'HubSpot ticket pipeline stage ID',
      placeholder: '1',
    },
  ];
  readonly optionalConfig: ConfigField[] = [
    {
      key: 'ownerId',
      label: 'Owner ID',
      type: 'string',
      description: 'HubSpot owner ID to assign tickets to',
    },
    {
      key: 'ticketPriority',
      label: 'Default Ticket Priority',
      type: 'select',
      description: 'Default priority when severity is not set',
      options: [
        { value: 'HIGH', label: 'High' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'LOW', label: 'Low' },
      ],
    },
  ];

  private readonly baseUrl = 'https://api.hubapi.com/crm/v3/objects/tickets';

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(config),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HubSpot API error: ${response.status} - ${errorBody}`);
      }

      return {
        success: true,
        message: 'Successfully connected to HubSpot CRM',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to connect to HubSpot',
      };
    }
  }

  async syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const properties = this.buildTicketProperties(ticket, config);
      const additionalMappings = this.applyMappings(ticket, mappings);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(config),
        body: JSON.stringify({
          properties: { ...properties, ...additionalMappings },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HubSpot API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();

      return {
        success: true,
        externalId: data.id,
        externalUrl: `https://app.hubspot.com/contacts/tickets/${data.id}`,
        message: 'Ticket created in HubSpot',
      };
    } catch (error) {
      return this.handleApiError(error, 'syncTicket');
    }
  }

  async updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult> {
    try {
      const properties = this.buildTicketProperties(ticket, config);
      const additionalMappings = this.applyMappings(ticket, mappings);

      const response = await fetch(`${this.baseUrl}/${externalId}`, {
        method: 'PATCH',
        headers: this.getHeaders(config),
        body: JSON.stringify({
          properties: { ...properties, ...additionalMappings },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HubSpot API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();

      return {
        success: true,
        externalId: data.id,
        externalUrl: `https://app.hubspot.com/contacts/tickets/${data.id}`,
        message: 'Ticket updated in HubSpot',
      };
    } catch (error) {
      return this.handleApiError(error, 'updateTicket');
    }
  }

  async deleteTicket(externalId: string, config: IntegrationConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${externalId}`, {
      method: 'DELETE',
      headers: this.getHeaders(config),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${errorBody}`);
    }
  }

  private getHeaders(config: IntegrationConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
    };
  }

  private buildTicketProperties(ticket: Ticket, config: IntegrationConfig): Record<string, string> {
    const contentParts: string[] = [];

    if (ticket.description) {
      contentParts.push(ticket.description);
    }

    if (ticket.aiSummary) {
      contentParts.push(`\n--- AI Summary ---\n${ticket.aiSummary}`);
    }

    if (ticket.aiAnalysis) {
      const analysis = typeof ticket.aiAnalysis === 'string' ? ticket.aiAnalysis : JSON.stringify(ticket.aiAnalysis);
      contentParts.push(`\n--- AI Analysis ---\n${analysis}`);
    }

    const properties: Record<string, string> = {
      subject: ticket.title || 'Untitled Ticket',
      content: contentParts.join('\n') || 'No description provided',
      hs_pipeline: config.pipelineId,
      hs_pipeline_stage: config.pipelineStageId,
      hs_ticket_priority: this.mapSeverityToPriority(ticket.severity, config.ticketPriority),
    };

    if (config.ownerId) {
      properties.hubspot_owner_id = config.ownerId;
    }

    return properties;
  }

  private mapSeverityToPriority(severity: string | null, defaultPriority?: string): string {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'HIGH';
      case 'medium':
        return 'MEDIUM';
      case 'low':
        return 'LOW';
      default:
        return defaultPriority || 'MEDIUM';
    }
  }
}

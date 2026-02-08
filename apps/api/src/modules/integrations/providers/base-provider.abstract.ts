import { Logger } from '@nestjs/common';
import { Ticket } from '@prisma/client';
import { IntegrationProvider } from './integration-provider.interface';
import { IntegrationConfig, SyncResult, ConfigField, FieldMapping } from '../types/integration.types';

export abstract class BaseIntegrationProvider implements IntegrationProvider {
  abstract readonly type: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly requiredConfig: ConfigField[];
  abstract readonly optionalConfig: ConfigField[];

  readonly supportsOAuth: boolean = false;
  readonly supportedMappings: FieldMapping[] = [];

  protected logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  async validateConfig(config: IntegrationConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    for (const field of this.requiredConfig) {
      if (!config[field.key] || config[field.key] === '') {
        errors.push(`${field.label} is required`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  abstract testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }>;

  abstract syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult>;

  abstract updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult>;

  protected applyMappings(ticket: Ticket, mappings?: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {};

    if (!mappings) return mapped;

    const ticketData = ticket as Record<string, any>;

    for (const [source, target] of Object.entries(mappings)) {
      if (ticketData[source]) {
        mapped[target] = ticketData[source];
      }
    }

    return mapped;
  }

  protected handleApiError(error: any, operation: string): SyncResult {
    this.logger.error(`${operation} failed: ${error.message}`, error.stack);
    return {
      success: false,
      error: error.message || 'Unknown error',
      metadata: { operation },
    };
  }
}

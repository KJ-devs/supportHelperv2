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

  abstract syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, unknown>): Promise<SyncResult>;

  abstract updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, unknown>): Promise<SyncResult>;

  protected applyMappings(ticket: Ticket, mappings?: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    if (!mappings) return mapped;

    const ticketData = ticket as Record<string, unknown>;

    for (const [source, target] of Object.entries(mappings)) {
      if (ticketData[source]) {
        mapped[target as string] = ticketData[source];
      }
    }

    return mapped;
  }

  protected handleApiError(error: unknown, operation: string): SyncResult {
    const err = error as { message?: string; stack?: string };
    this.logger.error(`${operation} failed: ${err.message}`, err.stack);
    return {
      success: false,
      error: err.message || 'Unknown error',
      metadata: { operation },
    };
  }
}

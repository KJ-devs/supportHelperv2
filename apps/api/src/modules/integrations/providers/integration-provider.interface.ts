import { Ticket } from '@prisma/client';
import { IntegrationConfig, SyncResult, PullResult, ConfigField, FieldMapping } from '../types/integration.types';

export interface IntegrationProvider {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly requiredConfig: ConfigField[];
  readonly optionalConfig: ConfigField[];
  readonly supportsOAuth: boolean;
  readonly supportedMappings: FieldMapping[];

  validateConfig(config: IntegrationConfig): Promise<{ valid: boolean; errors?: string[] }>;

  testConnection(config: IntegrationConfig): Promise<{ success: boolean; message?: string; error?: string }>;

  syncTicket(ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult>;

  updateTicket(externalId: string, ticket: Ticket, config: IntegrationConfig, mappings?: Record<string, any>): Promise<SyncResult>;

  deleteTicket?(externalId: string, config: IntegrationConfig): Promise<void>;

  pullTickets?(config: IntegrationConfig, options?: { startAt?: number; maxResults?: number; since?: string }): Promise<PullResult>;

  getAuthorizationUrl?(state: string, config: IntegrationConfig): string;

  exchangeCodeForToken?(code: string, config: IntegrationConfig): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;

  refreshAccessToken?(refreshToken: string, config: IntegrationConfig): Promise<{ accessToken: string; expiresAt?: Date }>;
}

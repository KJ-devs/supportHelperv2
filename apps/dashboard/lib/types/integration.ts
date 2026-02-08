export interface Integration {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  mappings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  _count?: {
    syncLogs: number;
  };
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  ticketId: string;
  externalId?: string;
  status: string;
  attemptCount: number;
  error?: string;
  metadata?: Record<string, any>;
  syncedAt: string;
  ticket?: {
    id: string;
    title: string;
    status: string;
  };
}

export interface IntegrationType {
  type: string;
  name: string;
  description: string;
  requiredConfig: ConfigField[];
  optionalConfig: ConfigField[];
  supportsOAuth: boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'password' | 'url' | 'select';
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface CreateIntegrationData {
  type: string;
  name: string;
  enabled?: boolean;
  config: Record<string, any>;
  mappings?: Record<string, any>;
}

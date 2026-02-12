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
  action?: string;
  durationMs?: number;
  externalUrl?: string;
  triggeredBy?: string;
  provider?: string;
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

export interface IntegrationSyncStats {
  total: number;
  success: number;
  failed: number;
  retrying: number;
  successRate: number;
  recentLogs: Array<{
    id: string;
    status: string;
    action?: string;
    durationMs?: number;
    syncedAt: string;
    error?: string;
    provider?: string;
  }>;
}

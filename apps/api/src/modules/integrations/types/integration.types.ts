export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'password' | 'url' | 'select';
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  mappingType: 'direct' | 'transform';
  defaultValue?: unknown;
  transformFn?: string;
}

export interface SyncResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PullResult {
  success: boolean;
  tickets: PulledTicket[];
  total: number;
  error?: string;
}

export interface PulledTicket {
  externalId: string;
  externalUrl?: string;
  title: string;
  description?: string;
  status?: string;
  severity?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IntegrationConfig = Record<string, any>;

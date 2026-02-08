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
  defaultValue?: any;
  transformFn?: string;
}

export interface SyncResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export type IntegrationConfig = Record<string, any>;

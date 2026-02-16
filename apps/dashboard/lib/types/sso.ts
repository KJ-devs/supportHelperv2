/**
 * SSO Configuration Types
 */

export type SsoProviderType = 'saml' | 'oidc';

export interface SsoConfigResponse {
  enabled: boolean;
  providerType: SsoProviderType;
  // SAML fields
  entityId?: string;
  ssoUrl?: string;
  certificate?: string; // masked
  // OIDC fields
  clientId?: string;
  clientSecret?: string; // masked
  issuerUrl?: string;
  // Common settings
  roleMapping: Record<string, string>;
  autoProvision: boolean;
  disablePassword: boolean;
  // Metadata
  configured: boolean;
  updatedAt?: string;
}

export interface UpdateSsoConfigRequest {
  enabled: boolean;
  providerType: SsoProviderType;
  // SAML fields
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  // OIDC fields
  clientId?: string;
  clientSecret?: string;
  issuerUrl?: string;
  // Common settings
  roleMapping?: Record<string, string>;
  autoProvision?: boolean;
  disablePassword?: boolean;
}

export interface TestSsoConnectionRequest {
  providerType: SsoProviderType;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  issuerUrl?: string;
}

export interface TestSsoConnectionResponse {
  success: boolean;
  message: string;
  details?: any;
}

export interface RoleMapping {
  id: string;
  idpGroup: string;
  appRole: 'admin' | 'member' | 'viewer';
}

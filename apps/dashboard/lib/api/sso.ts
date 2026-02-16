/**
 * SSO API Client
 * Interface for SSO configuration endpoints
 */

import { apiRequest } from './client';
import type {
  SsoConfigResponse,
  UpdateSsoConfigRequest,
  TestSsoConnectionRequest,
  TestSsoConnectionResponse,
} from '../types/sso';

export const ssoApi = {
  /**
   * Get current SSO configuration
   */
  async getConfig(): Promise<SsoConfigResponse> {
    return apiRequest('/api/system/auth/sso');
  },

  /**
   * Update SSO configuration
   */
  async updateConfig(config: UpdateSsoConfigRequest): Promise<SsoConfigResponse> {
    return apiRequest('/api/system/auth/sso', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  },

  /**
   * Delete SSO configuration
   */
  async deleteConfig(): Promise<void> {
    return apiRequest('/api/system/auth/sso', {
      method: 'DELETE',
    });
  },

  /**
   * Test SSO connection
   */
  async testConnection(
    config: TestSsoConnectionRequest
  ): Promise<TestSsoConnectionResponse> {
    return apiRequest('/api/system/auth/sso/test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
};

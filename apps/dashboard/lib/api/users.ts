/**
 * Users API Client
 * Client functions for user profile, password, and notification management
 */

import { apiRequest, ApiError } from './client';

export { ApiError };

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationPreferences {
  emailOnNewTicket?: boolean;
  emailOnStatusChange?: boolean;
  emailOnComment?: boolean;
  emailWeeklyReport?: boolean;
}

export const usersApi = {
  /**
   * List all users in the current tenant
   */
  getUsers: async (): Promise<User[]> => {
    return apiRequest<User[]>('/api/users');
  },

  /**
   * Update current user profile
   */
  updateProfile: async (data: UpdateProfileData): Promise<User> => {
    return apiRequest<User>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Change current user password
   */
  changePassword: async (data: ChangePasswordData): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>('/api/users/password', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update notification preferences
   */
  updateNotifications: async (
    preferences: NotificationPreferences
  ): Promise<{ success: boolean; preferences: NotificationPreferences }> => {
    return apiRequest<{ success: boolean; preferences: NotificationPreferences }>(
      '/api/users/notifications',
      {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      }
    );
  },
};

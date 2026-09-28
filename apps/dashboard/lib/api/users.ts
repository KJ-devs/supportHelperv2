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
  /** Invited but has not chosen a password yet */
  invitationPending?: boolean;
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface InviteUserData {
  email: string;
  name: string;
  role: Exclude<TeamRole, 'owner'>;
}

export interface InviteResult extends User {
  /** False when no email transport is configured or sending failed */
  invitationSent: boolean;
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
   * Invite a team member (owner/admin only). An email lets them choose a password.
   */
  invite: async (data: InviteUserData): Promise<InviteResult> => {
    return apiRequest<InviteResult>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  resendInvitation: async (id: string): Promise<{ invitationSent: boolean }> => {
    return apiRequest<{ invitationSent: boolean }>(`/api/users/${id}/resend-invitation`, {
      method: 'POST',
    });
  },

  updateRole: async (id: string, role: TeamRole): Promise<User> => {
    return apiRequest<User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  remove: async (id: string): Promise<void> => {
    await apiRequest(`/api/users/${id}`, { method: 'DELETE' });
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

/**
 * GitHub API Client
 * Interface for communicating with the GitHub integration API endpoints
 */

import { apiRequest } from './client';

// Types

export interface GitHubConnectionStatus {
  connected: boolean;
  connectionId?: string;
  repoCount?: number;
  createdAt?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  description?: string;
  defaultBranch: string;
  starCount: number;
  openIssuesCount: number;
  updatedAt: string;
}

export interface ListReposResponse {
  repositories: GitHubRepo[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface LinkedGitHubIssue {
  id: string;
  issueNumber: number;
  repository: string;
  url: string;
  state: string;
  title: string;
  syncStatus: string;
  lastSyncedAt: string;
}

export interface UserStoryIssueResponse {
  issue: {
    id: string;
    issueNumber: number;
    issueUrl: string;
    repository: string;
    title: string;
    state: string;
    createdAt: string;
  };
  userStory: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    technicalNotes: string;
    labels: string[];
    priority: string;
  };
}

export const githubApi = {
  /**
   * Get OAuth authorization URL
   */
  async getAuthorizationUrl(redirect?: string): Promise<{ url: string; state: string }> {
    const params = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
    return apiRequest(`/api/github/oauth/authorize${params}`);
  },

  /**
   * Check GitHub connection status
   */
  async getConnectionStatus(): Promise<GitHubConnectionStatus> {
    return apiRequest('/api/github/oauth/status');
  },

  /**
   * Disconnect GitHub integration
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/github/oauth/disconnect', {
      method: 'DELETE',
    });
  },

  /**
   * List repositories from GitHub
   */
  async listRepos(params?: {
    page?: number;
    perPage?: number;
    sort?: string;
    visibility?: string;
  }): Promise<ListReposResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.sort) query.append('sort', params.sort);
    if (params?.visibility) query.append('visibility', params.visibility);
    const qs = query.toString();
    return apiRequest(`/api/github/repos${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get linked GitHub issues for a ticket
   */
  async getLinkedIssues(ticketId: string): Promise<{ issues: LinkedGitHubIssue[] }> {
    return apiRequest(`/api/tickets/${ticketId}/github/issues`);
  },

  /**
   * Create a GitHub issue from a ticket
   */
  async createIssue(
    ticketId: string,
    data: { repository: string; title?: string; labels?: string[] }
  ): Promise<any> {
    return apiRequest(`/api/tickets/${ticketId}/github/create-issue`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create a user story GitHub issue from a ticket
   */
  async createUserStory(
    ticketId: string,
    data: { repository: string; additionalContext?: string }
  ): Promise<UserStoryIssueResponse> {
    return apiRequest(`/api/tickets/${ticketId}/github/user-story`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Sync a ticket to its linked GitHub issues
   */
  async syncTicket(ticketId: string): Promise<{ success: boolean }> {
    return apiRequest(`/api/tickets/${ticketId}/github/sync`, {
      method: 'POST',
    });
  },
};

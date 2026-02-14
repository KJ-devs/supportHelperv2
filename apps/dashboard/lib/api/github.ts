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

// GitHub App types

export interface GitHubAppInfo {
  appName: string;
  appSlug: string;
  appId: number;
  installUrl: string;
  description?: string;
}

export interface GitHubInstallation {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  accountAvatarUrl?: string;
  repositorySelection: string;
  createdAt: string;
}

export interface GitHubInstallationRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description?: string;
  defaultBranch: string;
  url: string;
}

export interface GitHubInstallationReposResponse {
  repositories: GitHubInstallationRepo[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export interface GitHubAppConfig {
  installationId?: number;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  autoCreateIssues?: boolean;
  syncEnabled?: boolean;
  labelSync?: boolean;
}

export interface ConnectRepoData {
  installationId: number;
  owner: string;
  repo: string;
  defaultBranch?: string;
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

  // ── GitHub App (installation-based flow) ──────────────────────────

  /**
   * Get GitHub App metadata and install URL
   */
  async getAppInfo(): Promise<GitHubAppInfo> {
    return apiRequest('/api/github/app/info');
  },

  /**
   * Get GitHub App installation URL
   */
  async getInstallUrl(): Promise<{ url: string }> {
    return apiRequest('/api/github/install');
  },

  /**
   * List GitHub App installations for the tenant
   */
  async getInstallations(): Promise<GitHubInstallation[]> {
    return apiRequest('/api/github/install/installations');
  },

  /**
   * Remove a GitHub App installation
   */
  async removeInstallation(id: string): Promise<void> {
    return apiRequest(`/api/github/install/installations/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * List repos accessible from a GitHub App installation
   */
  async getInstallationRepos(
    installationId: number,
    page?: number
  ): Promise<GitHubInstallationReposResponse> {
    return apiRequest(
      `/api/github/installations/${installationId}/repos?page=${page || 1}`
    );
  },

  /**
   * Link a GitHub repo to an application
   */
  async connectRepo(
    appId: string,
    data: ConnectRepoData
  ): Promise<{ success: boolean }> {
    return apiRequest(`/api/applications/${appId}/github/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Unlink a GitHub repo from an application
   */
  async disconnectRepo(appId: string): Promise<void> {
    return apiRequest(`/api/applications/${appId}/github/disconnect`, {
      method: 'DELETE',
    });
  },

  /**
   * Get GitHub config for an application
   */
  async getGithubConfig(appId: string): Promise<GitHubAppConfig> {
    return apiRequest(`/api/applications/${appId}/github/config`);
  },

  /**
   * Update GitHub settings for an application
   */
  async updateGithubSettings(
    appId: string,
    settings: Partial<GitHubAppConfig>
  ): Promise<GitHubAppConfig> {
    return apiRequest(`/api/applications/${appId}/github/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },
};

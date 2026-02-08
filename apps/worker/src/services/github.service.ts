import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

export interface GithubConnection {
  id: string;
  installationId: bigint;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}

/**
 * GitHub Service
 *
 * Handles GitHub API operations:
 * - Issue management (CRUD)
 * - Repository sync
 * - Authentication management
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private octokit: Octokit | null = null;
  private currentConnection: GithubConnection | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize GitHub client with connection credentials
   */
  async initialize(connection: GithubConnection): Promise<void> {
    this.currentConnection = connection;

    if (connection.accessToken) {
      this.octokit = new Octokit({
        auth: connection.accessToken,
      });
    } else {
      // Use app installation auth
      const appId = this.configService.get<string>('GITHUB_APP_ID');
      const privateKey = this.configService.get<string>('GITHUB_PRIVATE_KEY');

      this.octokit = new Octokit({
        authStrategy: require('@octokit/auth-app').createAppAuth,
        auth: {
          appId,
          privateKey,
          installationId: Number(connection.installationId),
        },
      });
    }

    this.logger.log(`GitHub client initialized for installation ${connection.installationId}`);
  }

  /**
   * Parse repo string (owner/repo) into parts
   */
  private parseRepo(repo: string): { owner: string; repo: string } {
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error(`Invalid repo format: ${repo}. Expected owner/repo`);
    }
    return { owner, repo: repoName };
  }

  /**
   * Ensure client is initialized
   */
  private ensureClient(): Octokit {
    if (!this.octokit) {
      throw new Error('GitHub client not initialized. Call initialize() first.');
    }
    return this.octokit;
  }

  /**
   * List issues from a repository
   */
  async listIssues(
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      since?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<any[]> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.listForRepo({
      owner,
      repo: repoName,
      state: options.state || 'all',
      since: options.since,
      per_page: options.per_page || 100,
      page: options.page || 1,
    });

    return response.data;
  }

  /**
   * Create a new issue
   */
  async createIssue(
    repo: string,
    options: {
      title: string;
      body: string;
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    }
  ): Promise<any> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.create({
      owner,
      repo: repoName,
      title: options.title,
      body: options.body,
      labels: options.labels,
      assignees: options.assignees,
      milestone: options.milestone,
    });

    this.logger.log(`Created issue #${response.data.number} in ${repo}`);
    return response.data;
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    repo: string,
    issueNumber: number,
    options: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<any> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.update({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      ...options,
    });

    this.logger.log(`Updated issue #${issueNumber} in ${repo}`);
    return response.data;
  }

  /**
   * Get a single issue
   */
  async getIssue(repo: string, issueNumber: number): Promise<any> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.get({
      owner,
      repo: repoName,
      issue_number: issueNumber,
    });

    return response.data;
  }

  /**
   * Add a comment to an issue
   */
  async addComment(repo: string, issueNumber: number, body: string): Promise<any> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.createComment({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      body,
    });

    return response.data;
  }

  /**
   * List comments on an issue
   */
  async listComments(
    repo: string,
    issueNumber: number,
    options: { per_page?: number; page?: number } = {}
  ): Promise<any[]> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.issues.listComments({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      per_page: options.per_page || 100,
      page: options.page || 1,
    });

    return response.data;
  }

  /**
   * Get repository information
   */
  async getRepository(repo: string): Promise<any> {
    const client = this.ensureClient();
    const { owner, repo: repoName } = this.parseRepo(repo);

    const response = await client.repos.get({
      owner,
      repo: repoName,
    });

    return response.data;
  }

  /**
   * Search issues
   */
  async searchIssues(
    query: string,
    options: { per_page?: number; page?: number } = {}
  ): Promise<any[]> {
    const client = this.ensureClient();

    const response = await client.search.issuesAndPullRequests({
      q: query,
      per_page: options.per_page || 30,
      page: options.page || 1,
    });

    return response.data.items;
  }

  /**
   * Get authenticated user
   */
  async getAuthenticatedUser(): Promise<any> {
    const client = this.ensureClient();
    const response = await client.users.getAuthenticated();
    return response.data;
  }
}

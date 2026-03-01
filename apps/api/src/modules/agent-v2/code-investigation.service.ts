import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubAppService } from '../github/services/github-app.service';
import { CacheService } from '../../cache/cache.service';

export interface RepoContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  defaultBranch: string;
  installationId: string;
  tenantId: string;
  applicationId: string;
  repoConfigId: string;
  role: string;
  fullName: string;
  isPrimary: boolean;
}

export interface TreeEntry {
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface CodeSearchHit {
  filePath: string;
  matchCount: number;
  fragments: string[];
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

@Injectable()
export class CodeInvestigationService {
  private readonly logger = new Logger(CodeInvestigationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppService: GithubAppService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Resolve the primary GitHub config for an application and return a scoped Octokit.
   * Falls back to the first config if none is marked as primary.
   */
  async getRepoContext(applicationId: string): Promise<RepoContext | null> {
    return this.getPrimaryRepoContext(applicationId);
  }

  /**
   * Get the primary repo context for an application.
   */
  async getPrimaryRepoContext(applicationId: string): Promise<RepoContext | null> {
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId, isPrimary: true },
      include: { installation: true },
    });

    // Fallback to first config if none is primary
    const resolvedConfig = config ?? await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
      include: { installation: true },
    });

    if (!resolvedConfig) {
      return null;
    }

    return this.buildRepoContext(resolvedConfig, applicationId);
  }

  /**
   * Get all repo contexts for an application (multi-repo support).
   */
  async getAllRepoContexts(applicationId: string): Promise<RepoContext[]> {
    const configs = await this.prisma.projectGithubConfig.findMany({
      where: { applicationId },
      include: { installation: true },
      orderBy: { isPrimary: 'desc' },
    });

    const contexts: RepoContext[] = [];
    for (const config of configs) {
      contexts.push(await this.buildRepoContext(config, applicationId));
    }
    return contexts;
  }

  /**
   * Resolve a specific repo context by owner/repo.
   */
  async getRepoContextByName(applicationId: string, owner: string, repo: string): Promise<RepoContext | null> {
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId, owner, repo },
      include: { installation: true },
    });

    if (!config) {
      return null;
    }

    return this.buildRepoContext(config, applicationId);
  }

  private async buildRepoContext(
    config: {
      id: string;
      owner: string;
      repo: string;
      defaultBranch: string;
      isPrimary: boolean;
      role: string;
      installation: { installationId: bigint; tenantId: string };
    },
    applicationId: string,
  ): Promise<RepoContext> {
    const octokit = await this.githubAppService.getInstallationOctokit(
      Number(config.installation.installationId),
    );

    return {
      octokit,
      owner: config.owner,
      repo: config.repo,
      defaultBranch: config.defaultBranch,
      installationId: String(config.installation.installationId),
      tenantId: config.installation.tenantId,
      applicationId,
      repoConfigId: config.id,
      role: config.role,
      fullName: `${config.owner}/${config.repo}`,
      isPrimary: config.isPrimary,
    };
  }

  /**
   * Read a file via GitHub Contents API. Cached for 10 minutes.
   */
  async readFile(
    ctx: RepoContext,
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<string> {
    const cacheKey = `repo-file:${ctx.applicationId}:${filePath}:${ctx.defaultBranch}`;

    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached !== undefined) {
      return this.filterLines(cached, startLine, endLine);
    }

    const { data } = await ctx.octokit.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      ref: ctx.defaultBranch,
    });

    if (!('content' in data) || data.encoding !== 'base64') {
      throw new Error(`Cannot read ${filePath}: not a file or too large`);
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    await this.cacheService.set(cacheKey, content, 10 * 60);

    return this.filterLines(content, startLine, endLine);
  }

  /**
   * List files and directories using GitHub Trees API.
   */
  async listDirectory(
    ctx: RepoContext,
    path: string,
    recursive = false,
  ): Promise<TreeEntry[]> {
    const treeSha = path
      ? `${ctx.defaultBranch}:${path}`
      : ctx.defaultBranch;

    const { data: tree } = await ctx.octokit.git.getTree({
      owner: ctx.owner,
      repo: ctx.repo,
      tree_sha: treeSha,
      recursive: recursive ? 'true' : undefined,
    });

    return tree.tree
      .filter((item) => {
        if (recursive) {
          const depth = (item.path || '').split('/').length;
          return depth <= 2;
        }
        return true;
      })
      .map((item) => ({
        path: item.path || '',
        type: item.type === 'tree' ? ('directory' as const) : ('file' as const),
        size: item.size,
      }));
  }

  /**
   * Search code using GitHub Code Search API.
   */
  async searchCode(
    ctx: RepoContext,
    query: string,
    filePattern?: string,
    maxResults = 20,
  ): Promise<CodeSearchHit[]> {
    const q =
      `${query} repo:${ctx.owner}/${ctx.repo}` +
      (filePattern ? ` path:${filePattern}` : '');

    const { data } = await ctx.octokit.search.code({
      q,
      per_page: Math.min(maxResults, 100),
    });

    return data.items.map((item) => ({
      filePath: item.path,
      matchCount: item.text_matches?.length || 0,
      fragments: item.text_matches?.map((m) => m.fragment).filter((f): f is string => f !== undefined) || [],
    }));
  }

  /**
   * Get a condensed tree view of the entire repository. Cached 1 hour.
   */
  async getRepoStructure(
    ctx: RepoContext,
    maxDepth = 3,
    excludePatterns: string[] = [],
  ): Promise<string> {
    const cacheKey = `repo-structure:${ctx.applicationId}`;

    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const defaults = ['node_modules', 'dist', '.git', '*.lock', '.next', 'coverage'];
    const exclude = [...defaults, ...excludePatterns];

    const { data: tree } = await ctx.octokit.git.getTree({
      owner: ctx.owner,
      repo: ctx.repo,
      tree_sha: ctx.defaultBranch,
      recursive: 'true',
    });

    const filtered = tree.tree.filter((item) => {
      const path = item.path || '';
      const depth = path.split('/').length;
      if (depth > maxDepth) return false;
      return !exclude.some((pattern) => {
        if (pattern.startsWith('*')) return path.endsWith(pattern.slice(1));
        return path.includes(pattern);
      });
    });

    const result = this.formatAsTree(filtered);
    await this.cacheService.set(cacheKey, result, 60 * 60);
    return result;
  }

  /**
   * Get recent git commit history for a file.
   */
  async getFileHistory(
    ctx: RepoContext,
    filePath: string,
    limit = 5,
  ): Promise<CommitInfo[]> {
    const { data: commits } = await ctx.octokit.repos.listCommits({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      per_page: limit,
    });

    return commits.map((c) => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name || 'Unknown',
      date: c.commit.author?.date || '',
    }));
  }

  /**
   * Get git blame information via GitHub REST blame endpoint.
   */
  async getFileBlame(
    ctx: RepoContext,
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<unknown> {
    try {
      const response = await ctx.octokit.request(
        'GET /repos/{owner}/{repo}/blame/{path}',
        {
          owner: ctx.owner,
          repo: ctx.repo,
          path: filePath,
          ref: ctx.defaultBranch,
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      let ranges = (response.data as { ranges?: Array<{ startingLine: number; endingLine: number; commit: { sha: string; author?: { name?: string; date?: string }; message: string } }> }).ranges || [];

      if (startLine || endLine) {
        ranges = ranges.filter((range) => {
          if (startLine && range.endingLine < startLine) return false;
          if (endLine && range.startingLine > endLine) return false;
          return true;
        });
      }

      return ranges.map((range) => ({
        startLine: range.startingLine,
        endLine: range.endingLine,
        author: range.commit.author?.name || 'Unknown',
        date: range.commit.author?.date || '',
        sha: range.commit.sha.substring(0, 7),
        message: range.commit.message.split('\n')[0],
      }));
    } catch (error) {
      this.logger.warn(`Failed to get blame for ${filePath}: ${(error as Error).message}`);
      return { error: `Could not get blame: ${(error as Error).message}` };
    }
  }

  /**
   * Create a new branch from a base branch (defaults to the repo's default branch).
   */
  async createBranch(
    ctx: RepoContext,
    branchName: string,
    fromBranch?: string,
  ): Promise<{ branchName: string; sha: string }> {
    const base = fromBranch || ctx.defaultBranch;

    const { data: refData } = await ctx.octokit.git.getRef({
      owner: ctx.owner,
      repo: ctx.repo,
      ref: `heads/${base}`,
    });

    const sha = refData.object.sha;

    await ctx.octokit.git.createRef({
      owner: ctx.owner,
      repo: ctx.repo,
      ref: `refs/heads/${branchName}`,
      sha,
    });

    this.logger.log(`Created branch ${branchName} from ${base} (${sha.substring(0, 7)}) in ${ctx.fullName}`);
    return { branchName, sha };
  }

  /**
   * Create or update a file on a branch.
   * Automatically retrieves the existing file SHA if the file already exists.
   */
  async writeFile(
    ctx: RepoContext,
    branch: string,
    filePath: string,
    content: string,
    commitMessage: string,
  ): Promise<{ sha: string; url: string }> {
    let existingSha: string | undefined;

    try {
      const { data } = await ctx.octokit.repos.getContent({
        owner: ctx.owner,
        repo: ctx.repo,
        path: filePath,
        ref: branch,
      });

      if ('sha' in data) {
        existingSha = data.sha;
      }
    } catch {
      // File does not exist yet — create it
    }

    const { data } = await ctx.octokit.repos.createOrUpdateFileContents({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const commitSha = data.commit.sha!;
    const fileUrl = data.content?.html_url ?? '';

    this.logger.log(`Wrote ${filePath} on branch ${branch} (commit ${commitSha.substring(0, 7)}) in ${ctx.fullName}`);
    return { sha: commitSha, url: fileUrl };
  }

  /**
   * Apply a targeted find-and-replace edit to a file on a branch.
   * Reads the current content, replaces old_text with new_text, and commits.
   */
  async editFile(
    ctx: RepoContext,
    branch: string,
    filePath: string,
    oldText: string,
    newText: string,
    commitMessage: string,
  ): Promise<{ sha: string; url: string }> {
    // 1. Read the current file content
    let currentContent: string;
    let existingSha: string;
    try {
      const { data } = await ctx.octokit.repos.getContent({
        owner: ctx.owner,
        repo: ctx.repo,
        path: filePath,
        ref: branch,
      });

      if (!('content' in data) || !('sha' in data)) {
        throw new Error(`${filePath} is not a file or has no content`);
      }

      currentContent = Buffer.from(data.content, 'base64').toString('utf-8');
      existingSha = data.sha;
    } catch (error) {
      if ((error as any).status === 404) {
        throw new Error(`File not found: ${filePath} on branch ${branch}`);
      }
      throw error;
    }

    // 2. Find and replace
    if (!currentContent.includes(oldText)) {
      throw new Error(
        `old_text not found in ${filePath}. Ensure the text matches exactly (including whitespace and line breaks).`,
      );
    }

    const updatedContent = currentContent.replace(oldText, newText);

    // 3. Write the updated file
    const { data } = await ctx.octokit.repos.createOrUpdateFileContents({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(updatedContent).toString('base64'),
      branch,
      sha: existingSha,
    });

    const commitSha = data.commit.sha!;
    const fileUrl = data.content?.html_url ?? '';

    this.logger.log(`Edited ${filePath} on branch ${branch} (commit ${commitSha.substring(0, 7)}) in ${ctx.fullName}`);
    return { sha: commitSha, url: fileUrl };
  }

  /**
   * Open a pull request.
   */
  async createPullRequest(
    ctx: RepoContext,
    title: string,
    body: string,
    headBranch: string,
    baseBranch?: string,
  ): Promise<{ number: number; url: string; title: string }> {
    const base = baseBranch || ctx.defaultBranch;

    const { data } = await ctx.octokit.pulls.create({
      owner: ctx.owner,
      repo: ctx.repo,
      title,
      body,
      head: headBranch,
      base,
    });

    this.logger.log(`Created PR #${data.number} "${title}" in ${ctx.fullName}`);
    return { number: data.number, url: data.html_url, title: data.title };
  }

  private filterLines(content: string, startLine?: number, endLine?: number): string {
    if (!startLine && !endLine) return content;
    const lines = content.split('\n');
    const start = (startLine || 1) - 1;
    const end = endLine || lines.length;
    return lines.slice(start, end).join('\n');
  }

  private formatAsTree(
    items: Array<{ path?: string; type?: string }>,
  ): string {
    const lines: string[] = [];

    for (const item of items) {
      const path = item.path || '';
      const depth = path.split('/').length - 1;
      const indent = '  '.repeat(depth);
      const name = path.split('/').pop() || path;
      const icon = item.type === 'tree' ? '📁' : '📄';
      lines.push(`${indent}${icon} ${name}`);
    }

    return lines.join('\n');
  }
}

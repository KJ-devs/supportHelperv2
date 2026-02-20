import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../cache/cache.service';
import { GithubOAuthService } from './github-oauth.service';
import { GithubAppService } from './github-app.service';
import { TemplateRendererService } from './template-renderer.service';
import {
  CreateGithubIssueDto,
  GithubIssueResponseDto,
  LinkedGithubIssueDto,
  RelatedGithubIssueDto,
  RelatedIssuesResponseDto,
} from '../dto';
import type { Ticket, Media, Application } from '@prisma/client';

type TicketWithRelations = Ticket & {
  media: Media[];
  application: Application | null;
};

/** TTL in seconds for sync-origin Redis keys (anti-loop protection) */
const SYNC_ORIGIN_TTL = 30;

@Injectable()
export class GithubIssuesService {
  private readonly logger = new Logger(GithubIssuesService.name);
  private readonly apiUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private cacheService: CacheService,
    private oauthService: GithubOAuthService,
    private appService: GithubAppService,
    private templateRenderer: TemplateRendererService,
  ) {
    this.apiUrl = this.config.get('app.apiUrl') || 'http://localhost:3000';
  }

  /**
   * Create a GitHub issue from a ticket
   */
  async createIssueFromTicket(
    ticketId: string,
    tenantId: string,
    dto: CreateGithubIssueDto
  ): Promise<GithubIssueResponseDto> {
    // Get ticket with relations
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: true,
        application: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check if issue already exists for this ticket in this repo
    const existingIssue = await this.prisma.githubIssue.findFirst({
      where: {
        ticketId,
        githubRepo: dto.repository,
      },
    });

    if (existingIssue) {
      throw new BadRequestException(
        'GitHub issue already exists for this ticket in this repository'
      );
    }

    // Get Octokit client
    const octokit = await this.oauthService.getOctokitForTenant(tenantId);
    const [owner, repo] = dto.repository.split('/');

    if (!owner || !repo) {
      throw new BadRequestException('Invalid repository format. Use owner/repo');
    }

    // Build issue body
    const issueBody = this.formatTicketAsIssueBody(ticket, dto);

    // Build labels
    const labels = this.getIssueLabels(ticket, dto.labels);

    // Create GitHub issue
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: dto.title || ticket.title || `Support Ticket #${ticketId.slice(0, 8)}`,
      body: issueBody,
      labels,
      assignees: dto.assignees,
      milestone: dto.milestone,
    });

    // Save link in database
    const githubIssue = await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubIssueNumber: issue.number,
        githubRepo: dto.repository,
        githubIssueUrl: issue.html_url,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      },
    });

    this.logger.log(
      `Created GitHub issue #${issue.number} for ticket ${ticketId} in ${dto.repository}`
    );

    return {
      id: githubIssue.id,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      repository: dto.repository,
      title: issue.title,
      state: issue.state,
      createdAt: new Date(issue.created_at),
    };
  }

  /**
   * Get linked GitHub issues for a ticket
   */
  async getLinkedIssues(ticketId: string, tenantId: string): Promise<LinkedGithubIssueDto[]> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const issues = await this.prisma.githubIssue.findMany({
      where: { ticketId },
    });

    // Fetch current state from GitHub
    const octokit = await this.oauthService.getOctokitForTenant(tenantId);

    const linkedIssues: LinkedGithubIssueDto[] = [];

    for (const issue of issues) {
      try {
        const [owner, repo] = issue.githubRepo.split('/');
        const { data: githubData } = await octokit.issues.get({
          owner,
          repo,
          issue_number: issue.githubIssueNumber,
        });

        linkedIssues.push({
          id: issue.id,
          issueNumber: issue.githubIssueNumber,
          repository: issue.githubRepo,
          url: issue.githubIssueUrl || githubData.html_url,
          state: githubData.state,
          title: githubData.title,
          syncStatus: issue.syncStatus,
          lastSyncedAt: issue.lastSyncedAt,
        });
      } catch (error) {
        // Issue might be deleted or inaccessible
        linkedIssues.push({
          id: issue.id,
          issueNumber: issue.githubIssueNumber,
          repository: issue.githubRepo,
          url: issue.githubIssueUrl || '',
          state: 'unknown',
          title: 'Unable to fetch',
          syncStatus: 'error',
          lastSyncedAt: issue.lastSyncedAt,
        });
      }
    }

    return linkedIssues;
  }

  /**
   * Search for related GitHub issues
   */
  async findRelatedIssues(
    ticketId: string,
    tenantId: string,
    repository?: string
  ): Promise<RelatedIssuesResponseDto> {
    // Get ticket
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: { application: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Determine repository to search
    const searchRepo = repository || ticket.application?.githubRepo;

    if (!searchRepo) {
      throw new BadRequestException('No repository specified and no linked repository found');
    }

    const octokit = await this.oauthService.getOctokitForTenant(tenantId);
    const [owner, repo] = searchRepo.split('/');

    // Build search query from ticket
    const searchTerms = this.buildSearchTerms(ticket);
    const query = `repo:${searchRepo} is:issue ${searchTerms}`;

    // Search GitHub issues
    const { data: searchResult } = await octokit.search.issuesAndPullRequests({
      q: query,
      sort: 'updated',
      order: 'desc',
      per_page: 10,
    });

    // Filter to issues only and map to DTO
    const relatedIssues: RelatedGithubIssueDto[] = searchResult.items
      .filter(item => !item.pull_request)
      .map((item, index) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state,
        labels: item.labels.map(l => (typeof l === 'string' ? l : l.name || '')),
        score: (10 - index) / 10, // Simple relevance score based on position
        createdAt: item.created_at,
        closedAt: item.closed_at || undefined,
      }));

    return {
      issues: relatedIssues,
      query: searchTerms,
      repository: searchRepo,
    };
  }

  /**
   * Sync ticket state to GitHub issue
   */
  async syncTicketToIssue(ticketId: string, tenantId: string): Promise<void> {
    const githubIssues = await this.prisma.githubIssue.findMany({
      where: {
        ticketId,
        ticket: { tenantId },
      },
      include: { ticket: true },
    });

    if (githubIssues.length === 0) {
      throw new NotFoundException('No GitHub issues linked to this ticket');
    }

    const octokit = await this.oauthService.getOctokitForTenant(tenantId);

    for (const githubIssue of githubIssues) {
      try {
        const [owner, repo] = githubIssue.githubRepo.split('/');
        const ticket = githubIssue.ticket;

        if (!ticket) {
          this.logger.warn(`No ticket found for GitHub issue ${githubIssue.id}`);
          continue;
        }

        await octokit.issues.update({
          owner,
          repo,
          issue_number: githubIssue.githubIssueNumber,
          state: ticket.status === 'resolved' ? 'closed' : 'open',
        });

        await this.prisma.githubIssue.update({
          where: { id: githubIssue.id },
          data: {
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
        });

        this.logger.log(
          `Synced ticket ${ticketId} to GitHub issue #${githubIssue.githubIssueNumber}`
        );
      } catch (error) {
        this.logger.error(`Failed to sync issue ${githubIssue.id}:`, error);

        await this.prisma.githubIssue.update({
          where: { id: githubIssue.id },
          data: { syncStatus: 'error' },
        });
      }
    }
  }

  /**
   * Set a short-lived Redis flag indicating the sync origin for a ticket.
   * Used by the anti-loop mechanism to prevent infinite GitHub <-> ticket sync cycles.
   */
  async setSyncOrigin(ticketId: string, origin: 'github' | 'platform'): Promise<void> {
    const key = `github:sync-origin:${ticketId}`;
    await this.cacheService.set(key, origin, SYNC_ORIGIN_TTL);
  }

  /**
   * Check whether the most recent status change for a ticket originated from GitHub.
   * Returns true if the sync-origin flag is set to 'github', meaning we should NOT
   * sync back to GitHub (would cause a loop).
   */
  async isSyncFromGithub(ticketId: string): Promise<boolean> {
    const key = `github:sync-origin:${ticketId}`;
    const origin = await this.cacheService.get<string>(key);
    return origin === 'github';
  }

  /**
   * Check whether the most recent status change for a ticket originated from the platform.
   * Returns true if the sync-origin flag is set to 'platform', meaning we should NOT
   * sync from GitHub to ticket (would cause a loop).
   */
  async isSyncFromPlatform(ticketId: string): Promise<boolean> {
    const key = `github:sync-origin:${ticketId}`;
    const origin = await this.cacheService.get<string>(key);
    return origin === 'platform';
  }

  /**
   * Reverse sync: push ticket status change to all linked GitHub issues.
   * Called when a ticket status changes from the platform (dashboard/API).
   * Checks the anti-loop flag to avoid syncing back changes that came from GitHub.
   */
  async syncTicketStatusToGithub(ticketId: string, newStatus: string): Promise<void> {
    // Anti-loop: if the status change came from GitHub, do not sync back
    if (await this.isSyncFromGithub(ticketId)) {
      this.logger.debug(`Skipping reverse sync for ticket ${ticketId} — change originated from GitHub`);
      return;
    }

    const githubIssues = await this.prisma.githubIssue.findMany({
      where: { ticketId },
      include: { ticket: { include: { application: true } } },
    });

    if (githubIssues.length === 0) {
      return;
    }

    for (const ghIssue of githubIssues) {
      try {
        const [owner, repo] = ghIssue.githubRepo.split('/');
        const desiredState: 'open' | 'closed' = newStatus === 'resolved' || newStatus === 'closed' ? 'closed' : 'open';

        // Get installation-based Octokit if possible, fall back to OAuth
        let octokit;
        const appId = ghIssue.ticket?.applicationId;
        if (appId) {
          const config = await this.prisma.projectGithubConfig.findFirst({
            where: { applicationId: appId },
          });
          if (config) {
            octokit = await this.appService.getInstallationOctokit(Number(config.installationId));
          }
        }
        if (!octokit && ghIssue.ticket?.tenantId) {
          octokit = await this.oauthService.getOctokitForTenant(ghIssue.ticket.tenantId);
        }
        if (!octokit) {
          this.logger.warn(`No auth available for reverse sync of ticket ${ticketId}`);
          continue;
        }

        // Set sync-origin flag BEFORE calling GitHub API so the incoming webhook
        // (if any) will see the flag and skip reverse-processing.
        await this.setSyncOrigin(ticketId, 'platform');

        await octokit.issues.update({
          owner,
          repo,
          issue_number: ghIssue.githubIssueNumber,
          state: desiredState,
        });

        await this.prisma.githubIssue.update({
          where: { id: ghIssue.id },
          data: {
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
        });

        this.logger.log(
          `Reverse-synced ticket ${ticketId} -> GitHub issue #${ghIssue.githubIssueNumber} (${desiredState})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to reverse-sync ticket ${ticketId} to GitHub issue ${ghIssue.id}: ${error.message}`,
        );

        await this.prisma.githubIssue.update({
          where: { id: ghIssue.id },
          data: { syncStatus: 'error' },
        });
      }
    }
  }

  /**
   * Auto-create a GitHub issue when a ticket is created, using the
   * ProjectGithubConfig linked to the ticket's application.
   * Called by the BullMQ processor for 'create-github-issue' jobs.
   */
  async autoCreateIssueFromTicket(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { media: true, application: true },
    });
    if (!ticket || !ticket.applicationId) return;

    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId: ticket.applicationId },
    });
    if (!config) return;

    const { owner, repo, installationId, settings } = config;
    const repository = `${owner}/${repo}`;

    const existing = await this.prisma.githubIssue.findFirst({
      where: { ticketId, githubRepo: repository },
    });
    if (existing) return;

    const octokit = await this.appService.getInstallationOctokit(Number(installationId));
    const configSettings = (settings as Record<string, any>) ?? {};
    const customTemplate = configSettings.issueBodyTemplate as string | undefined;
    const issueBody = this.formatTicketAsIssueBody(
      ticket as TicketWithRelations,
      {
        repository,
        includeAiAnalysis: true,
        includeVideoLink: true,
      },
      customTemplate || undefined,
    );

    const defaultLabels = configSettings.defaultLabels
      ? (configSettings.defaultLabels as string).split(',').map((l: string) => l.trim())
      : [];
    const labels = this.getIssueLabels(ticket, defaultLabels);

    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: ticket.title || `Support Ticket #${ticketId.slice(0, 8)}`,
      body: issueBody,
      labels,
    });

    await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubIssueNumber: issue.number,
        githubRepo: repository,
        githubIssueUrl: issue.html_url,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      },
    });

    this.logger.log(`Auto-created GitHub issue #${issue.number} for ticket ${ticketId} in ${repository}`);
  }

  /**
   * Unlink a GitHub issue from ticket
   */
  async unlinkIssue(issueId: string, tenantId: string): Promise<void> {
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        id: issueId,
        ticket: { tenantId },
      },
    });

    if (!githubIssue) {
      throw new NotFoundException('GitHub issue link not found');
    }

    await this.prisma.githubIssue.delete({
      where: { id: issueId },
    });

    this.logger.log(`Unlinked GitHub issue ${issueId}`);
  }

  /**
   * Build the template data dictionary from a ticket.
   */
  private buildTemplateData(
    ticket: TicketWithRelations,
    options: CreateGithubIssueDto,
  ): Record<string, string> {
    // Steps
    let stepsText = 'No reproduction steps provided.';
    if (ticket.reproductionSteps) {
      const steps = this.parseJson(ticket.reproductionSteps);
      if (Array.isArray(steps) && steps.length > 0) {
        stepsText = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
      }
    }

    // User context
    let userContextText = 'No user context available.';
    if (ticket.userContext) {
      const context = this.parseJson(ticket.userContext);
      if (context && typeof context === 'object') {
        const lines = [
          `- **OS**: ${context.os || 'Unknown'}`,
          `- **Browser**: ${context.browser || 'Unknown'}`,
          `- **Version**: ${context.version || 'Unknown'}`,
          context.url ? `- **URL**: ${context.url}` : null,
        ].filter(Boolean);
        userContextText = lines.join('\n');
      }
    }

    // Recording URL
    let recordingUrl = 'No recordings available.';
    if (options.includeVideoLink !== false && ticket.media && ticket.media.length > 0) {
      const videos = ticket.media.filter(m => m.type === 'video');
      if (videos.length > 0) {
        recordingUrl = videos
          .map(v => {
            const url = v.storageUrl || `${this.apiUrl}/api/media/${v.id}`;
            return `[View Recording](${url})`;
          })
          .join('\n');
      }
    }

    // AI Analysis
    let aiAnalysis = 'No AI analysis available.';
    if (options.includeAiAnalysis !== false && ticket.aiSummary) {
      aiAnalysis = ticket.aiSummary;
    }

    type TicketWithReporter = typeof ticket & { reporterEmail?: string };
    return {
      title: ticket.title || `Support Ticket #${ticket.id.slice(0, 8)}`,
      description: ticket.description || 'No description provided.',
      severity: ticket.severity || 'unknown',
      type: ticket.type || 'unknown',
      steps: stepsText,
      recording_url: recordingUrl,
      ticket_url: `${this.apiUrl}/tickets/${ticket.id}`,
      reporter: (ticket as TicketWithReporter).reporterEmail || 'Unknown',
      ai_analysis: aiAnalysis,
      user_context: userContextText,
      ticket_id: ticket.id.slice(0, 8),
      status: ticket.status || 'open',
    };
  }

  /**
   * Format ticket as GitHub issue body.
   * Uses a custom template from ProjectGithubConfig settings if available,
   * otherwise falls back to the default template.
   */
  private formatTicketAsIssueBody(
    ticket: TicketWithRelations,
    options: CreateGithubIssueDto,
    customTemplate?: string,
  ): string {
    const data = this.buildTemplateData(ticket, options);
    const template = customTemplate || this.templateRenderer.getDefaultTemplate();
    return this.templateRenderer.render(template, data);
  }

  /**
   * Get labels for GitHub issue
   */
  private getIssueLabels(ticket: Ticket, additionalLabels?: string[]): string[] {
    const labels: string[] = ['support'];

    if (ticket.severity) {
      labels.push(`severity:${ticket.severity}`);
    }

    if (ticket.type) {
      labels.push(`type:${ticket.type}`);
    }

    if (additionalLabels) {
      labels.push(...additionalLabels.filter(l => !labels.includes(l)));
    }

    return labels;
  }

  /**
   * Build search terms from ticket
   */
  private buildSearchTerms(ticket: Ticket): string {
    const terms: string[] = [];

    // Add title words
    if (ticket.title) {
      const titleWords = ticket.title
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 3);
      terms.push(...titleWords);
    }

    // Add keywords
    if (ticket.keywords && ticket.keywords.length > 0) {
      terms.push(...ticket.keywords.slice(0, 3));
    }

    // Add type/severity as label filters
    if (ticket.type) {
      terms.push(`label:type:${ticket.type}`);
    }

    return terms.join(' ');
  }

  /**
   * Parse JSON safely
   */
  private parseJson(value: any): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }
}

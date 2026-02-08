import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubOAuthService } from './github-oauth.service';
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

@Injectable()
export class GithubIssuesService {
  private readonly logger = new Logger(GithubIssuesService.name);
  private readonly apiUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private oauthService: GithubOAuthService
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
   * Format ticket as GitHub issue body
   */
  private formatTicketAsIssueBody(
    ticket: TicketWithRelations,
    options: CreateGithubIssueDto
  ): string {
    const sections: string[] = [];

    // Description
    sections.push(`## Description\n\n${ticket.description || 'No description provided.'}`);

    // AI Analysis
    if (options.includeAiAnalysis !== false && ticket.aiSummary) {
      sections.push(`## AI Analysis\n\n${ticket.aiSummary}`);
    }

    // Reproduction Steps
    if (ticket.reproductionSteps) {
      const steps = this.parseJson(ticket.reproductionSteps);
      if (Array.isArray(steps) && steps.length > 0) {
        const stepsText = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
        sections.push(`## Reproduction Steps\n\n${stepsText}`);
      }
    }

    // User Context
    if (ticket.userContext) {
      const context = this.parseJson(ticket.userContext);
      if (context && typeof context === 'object') {
        const contextLines = [
          `- **OS**: ${context.os || 'Unknown'}`,
          `- **Browser**: ${context.browser || 'Unknown'}`,
          `- **Version**: ${context.version || 'Unknown'}`,
          context.url ? `- **URL**: ${context.url}` : null,
        ].filter(Boolean);

        sections.push(`## User Context\n\n${contextLines.join('\n')}`);
      }
    }

    // Video Link
    if (options.includeVideoLink !== false && ticket.media && ticket.media.length > 0) {
      const videos = ticket.media.filter(m => m.type === 'video');
      if (videos.length > 0) {
        const videoLinks = videos.map(v => {
          const url = v.storageUrl || `${this.apiUrl}/api/media/${v.id}`;
          return `- [View Recording](${url})`;
        });

        sections.push(
          `## Media\n\n${videoLinks.join('\n')}\n\n> Video recordings are available in the support platform.`
        );
      }
    }

    // Metadata
    const metadata = [
      `**Ticket ID**: \`${ticket.id.slice(0, 8)}\``,
      ticket.type ? `**Type**: ${ticket.type}` : null,
      ticket.severity ? `**Severity**: ${ticket.severity}` : null,
      ticket.status ? `**Status**: ${ticket.status}` : null,
    ].filter(Boolean);

    sections.push(`---\n\n${metadata.join(' | ')}\n\n*Created from Support Helper*`);

    return sections.join('\n\n');
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

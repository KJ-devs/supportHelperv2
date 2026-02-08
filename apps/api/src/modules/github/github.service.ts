import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookSecret: string;
  private readonly enabled: boolean;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {
    this.clientId = this.config.get('github.clientId') || '';
    this.clientSecret = this.config.get('github.clientSecret') || '';
    this.webhookSecret = this.config.get('github.webhookSecret') || '';
    this.enabled = this.config.get('github.enabled') || false;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    if (!this.enabled) {
      throw new Error('GitHub integration is not enabled');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${this.config.get('app.apiUrl')}/api/github/callback`,
      scope: 'repo,read:user,user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description}`);
    }

    return data.access_token;
  }

  /**
   * Get authenticated user's repositories
   */
  async getUserRepositories(accessToken: string) {
    const octokit = new Octokit({ auth: accessToken });

    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
    });

    return data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
    }));
  }

  /**
   * Create GitHub issue from ticket
   */
  async createIssueFromTicket(
    ticketId: string,
    tenantId: string,
    repo: string,
    accessToken: string
  ) {
    // Get ticket details
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

    // Create GitHub issue
    const [owner, repoName] = repo.split('/');
    const octokit = new Octokit({ auth: accessToken });

    const issueBody = this.formatTicketAsIssueBody(ticket);

    const { data: issue } = await octokit.issues.create({
      owner,
      repo: repoName,
      title: ticket.title || 'Support Ticket',
      body: issueBody,
      labels: this.getIssueLabels(ticket),
    });

    // Link ticket to GitHub issue
    await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubIssueNumber: issue.number,
        githubRepo: repo,
        githubIssueUrl: issue.html_url,
        syncStatus: 'synced',
      },
    });

    this.logger.log(`Created GitHub issue #${issue.number} for ticket ${ticketId}`);

    return issue;
  }

  /**
   * Sync ticket updates to GitHub issue
   */
  async syncTicketToIssue(ticketId: string, tenantId: string) {
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        ticketId,
        ticket: { tenantId },
      },
      include: {
        ticket: true,
      },
    });

    if (!githubIssue) {
      throw new NotFoundException('GitHub issue link not found');
    }

    // Get GitHub connection
    const connection = await this.prisma.githubConnection.findFirst({
      where: { tenantId },
    });

    if (!connection || !connection.accessToken) {
      throw new Error('GitHub connection not found');
    }

    // Update GitHub issue
    const [owner, repo] = githubIssue.githubRepo.split('/');
    const octokit = new Octokit({ auth: connection.accessToken });

    const ticket = githubIssue.ticket;
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await octokit.issues.update({
      owner,
      repo,
      issue_number: githubIssue.githubIssueNumber,
      body: this.formatTicketAsIssueBody(ticket),
      state: ticket.status === 'resolved' ? 'closed' : 'open',
    });

    // Update sync status
    await this.prisma.githubIssue.update({
      where: { id: githubIssue.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(`Synced ticket ${ticketId} to GitHub issue`);
  }

  /**
   * Handle GitHub webhook events
   */
  async handleWebhook(event: string, payload: any) {
    this.logger.log(`Received GitHub webhook: ${event}`);

    switch (event) {
      case 'issues':
        await this.handleIssueEvent(payload);
        break;
      case 'issue_comment':
        await this.handleIssueCommentEvent(payload);
        break;
      default:
        this.logger.debug(`Unhandled webhook event: ${event}`);
    }
  }

  private async handleIssueEvent(payload: any) {
    const { action, issue, repository } = payload;

    // Find linked ticket
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repository.full_name,
        githubIssueNumber: issue.number,
      },
    });

    if (!githubIssue || !githubIssue.ticketId) {
      return; // Not linked to any ticket
    }

    // Update ticket based on issue state
    if (action === 'closed') {
      await this.prisma.ticket.update({
        where: { id: githubIssue.ticketId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'reopened') {
      await this.prisma.ticket.update({
        where: { id: githubIssue.ticketId },
        data: {
          status: 'open',
          resolvedAt: null,
        },
      });
    }

    this.logger.log(`Updated ticket ${githubIssue.ticketId} from GitHub issue event`);
  }

  private async handleIssueCommentEvent(payload: any) {
    // Handle issue comments - could create ticket comments
    // Implementation depends on requirements
    this.logger.debug('Issue comment event received');
  }

  private formatTicketAsIssueBody(ticket: any): string {
    let body = `## Description\n\n${ticket.description || 'No description provided.'}\n\n`;

    if (ticket.aiSummary) {
      body += `## AI Analysis\n\n${ticket.aiSummary}\n\n`;
    }

    if (ticket.reproductionSteps) {
      body += `## Reproduction Steps\n\n`;
      const steps = JSON.parse(
        typeof ticket.reproductionSteps === 'string'
          ? ticket.reproductionSteps
          : JSON.stringify(ticket.reproductionSteps)
      );
      if (Array.isArray(steps)) {
        steps.forEach((step, i) => {
          body += `${i + 1}. ${step}\n`;
        });
      }
      body += '\n';
    }

    if (ticket.userContext) {
      const context =
        typeof ticket.userContext === 'string'
          ? JSON.parse(ticket.userContext)
          : ticket.userContext;
      body += `## User Context\n\n`;
      body += `- **OS**: ${context.os || 'Unknown'}\n`;
      body += `- **Browser**: ${context.browser || 'Unknown'}\n`;
      body += `- **Version**: ${context.version || 'Unknown'}\n\n`;
    }

    if (ticket.media && ticket.media.length > 0) {
      body += `## Media\n\n`;
      body += `Video and screenshots are available in the support platform.\n\n`;
    }

    body += `---\n*Created from Support Ticket #${ticket.id.slice(0, 8)}*`;

    return body;
  }

  private getIssueLabels(ticket: any): string[] {
    const labels: string[] = ['support'];

    if (ticket.severity) {
      labels.push(`severity:${ticket.severity}`);
    }

    if (ticket.type) {
      labels.push(`type:${ticket.type}`);
    }

    return labels;
  }
}

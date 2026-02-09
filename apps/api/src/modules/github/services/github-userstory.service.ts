import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AIService } from '../../../ai/ai.service';
import { GithubOAuthService } from './github-oauth.service';
import { CreateUserStoryDto, GeneratedUserStoryDto, UserStoryIssueResponseDto } from '../dto';

@Injectable()
export class GithubUserstoryService {
  private readonly logger = new Logger(GithubUserstoryService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    private oauthService: GithubOAuthService,
  ) {}

  /**
   * Generate a structured User Story from a ticket using AI
   */
  async generateUserStory(
    ticketId: string,
    tenantId: string,
    additionalContext?: string,
  ): Promise<GeneratedUserStoryDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: true,
        agentSessions: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        application: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Build the AI prompt with all available ticket context
    const prompt = this.buildUserStoryPrompt(ticket, additionalContext);

    const response = await this.aiService.generateCompletion(prompt);

    if (!response) {
      throw new BadRequestException(
        'AI service is unavailable. Please ensure OPENAI_API_KEY is configured.',
      );
    }

    // Parse structured JSON from response
    const parsed = this.parseUserStoryResponse(response);

    return parsed;
  }

  /**
   * Generate a User Story and create it as a GitHub issue
   */
  async createUserStoryIssue(
    ticketId: string,
    tenantId: string,
    dto: CreateUserStoryDto,
  ): Promise<UserStoryIssueResponseDto> {
    // Generate the user story via AI
    const userStory = await this.generateUserStory(ticketId, tenantId, dto.additionalContext);

    // Get the ticket for metadata
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Check if a user-story issue already exists for this ticket in this repo
    const existingIssue = await this.prisma.githubIssue.findFirst({
      where: {
        ticketId,
        githubRepo: dto.repository,
        // Check sync_status field for user-story marker
        syncStatus: 'user-story',
      },
    });

    if (existingIssue) {
      throw new BadRequestException(
        'A User Story issue already exists for this ticket in this repository',
      );
    }

    // Get Octokit client
    const octokit = await this.oauthService.getOctokitForTenant(tenantId);
    const [owner, repo] = dto.repository.split('/');

    if (!owner || !repo) {
      throw new BadRequestException('Invalid repository format. Use owner/repo');
    }

    // Format the issue body as markdown
    const issueBody = this.formatUserStoryBody(userStory, ticketId, ticket);

    // Build labels
    const labels = this.buildLabels(userStory, ticket);

    // Create the GitHub issue
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: userStory.title,
      body: issueBody,
      labels,
      assignees: dto.assignees,
      milestone: dto.milestone,
    });

    // Save link in GithubIssue table
    const githubIssue = await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubIssueNumber: issue.number,
        githubRepo: dto.repository,
        githubIssueUrl: issue.html_url,
        syncStatus: 'user-story',
        lastSyncedAt: new Date(),
      },
    });

    this.logger.log(
      `Created User Story issue #${issue.number} for ticket ${ticketId} in ${dto.repository}`,
    );

    return {
      issue: {
        id: githubIssue.id,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        repository: dto.repository,
        title: issue.title,
        state: issue.state,
        createdAt: new Date(issue.created_at),
      },
      userStory,
    };
  }

  /**
   * Build the AI prompt for User Story generation
   */
  private buildUserStoryPrompt(ticket: any, additionalContext?: string): string {
    const parts: string[] = [];

    parts.push(`You are a product manager. Transform the following bug report / support ticket into a structured GitHub User Story.`);
    parts.push('');
    parts.push('## Ticket Information');
    parts.push(`Title: ${ticket.title || 'No title'}`);
    parts.push(`Description: ${ticket.description || 'No description'}`);

    if (ticket.aiSummary) {
      parts.push(`AI Summary: ${ticket.aiSummary}`);
    }

    if (ticket.aiAnalysis) {
      const analysis = typeof ticket.aiAnalysis === 'string'
        ? ticket.aiAnalysis
        : JSON.stringify(ticket.aiAnalysis);
      parts.push(`AI Analysis: ${analysis}`);
    }

    if (ticket.severity) {
      parts.push(`Severity: ${ticket.severity}`);
    }

    if (ticket.type) {
      parts.push(`Type: ${ticket.type}`);
    }

    if (ticket.reproductionSteps) {
      const steps = typeof ticket.reproductionSteps === 'string'
        ? ticket.reproductionSteps
        : JSON.stringify(ticket.reproductionSteps);
      parts.push(`Reproduction Steps: ${steps}`);
    }

    if (ticket.keywords && ticket.keywords.length > 0) {
      parts.push(`Keywords: ${ticket.keywords.join(', ')}`);
    }

    // Include agent session conversation if available
    if (ticket.agentSessions && ticket.agentSessions.length > 0) {
      const latestSession = ticket.agentSessions[ticket.agentSessions.length - 1];
      if (latestSession.messages && latestSession.messages.length > 0) {
        parts.push('');
        parts.push('## Agent Conversation');
        for (const msg of latestSession.messages.slice(-10)) {
          parts.push(`${msg.role}: ${msg.content}`);
        }
      }
    }

    if (additionalContext) {
      parts.push('');
      parts.push(`## Additional Context`);
      parts.push(additionalContext);
    }

    parts.push('');
    parts.push('## Instructions');
    parts.push('Generate a structured User Story in JSON format with these fields:');
    parts.push('- title: A user story title in the format "As a [user type], I want [goal] so that [benefit]"');
    parts.push('- description: A detailed description of what needs to be done');
    parts.push('- acceptanceCriteria: An array of specific, testable acceptance criteria');
    parts.push('- technicalNotes: Technical implementation notes and considerations');
    parts.push('- labels: Suggested GitHub labels (e.g., "bug", "enhancement", "performance")');
    parts.push('- priority: One of "low", "medium", "high", "critical"');
    parts.push('');
    parts.push('Respond ONLY with valid JSON.');

    return parts.join('\n');
  }

  /**
   * Parse the AI response into a GeneratedUserStoryDto
   */
  private parseUserStoryResponse(response: string): GeneratedUserStoryDto {
    try {
      // Extract JSON from response (in case wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        title: parsed.title || 'As a user, I want this issue resolved',
        description: parsed.description || '',
        acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria)
          ? parsed.acceptanceCriteria
          : [],
        technicalNotes: parsed.technicalNotes || '',
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        priority: parsed.priority || 'medium',
      };
    } catch (error) {
      this.logger.error(`Failed to parse User Story AI response: ${error}`);
      throw new BadRequestException('Failed to generate User Story. AI response was not valid JSON.');
    }
  }

  /**
   * Format the User Story as a GitHub issue markdown body
   */
  private formatUserStoryBody(
    userStory: GeneratedUserStoryDto,
    ticketId: string,
    ticket: any,
  ): string {
    const sections: string[] = [];

    // User Story header
    sections.push(`## User Story`);
    sections.push('');
    sections.push(`**${userStory.title}**`);

    // Description
    sections.push('');
    sections.push(`## Description`);
    sections.push('');
    sections.push(userStory.description);

    // Acceptance Criteria as checkbox list
    if (userStory.acceptanceCriteria.length > 0) {
      sections.push('');
      sections.push(`## Acceptance Criteria`);
      sections.push('');
      for (const criterion of userStory.acceptanceCriteria) {
        sections.push(`- [ ] ${criterion}`);
      }
    }

    // Technical Notes
    if (userStory.technicalNotes) {
      sections.push('');
      sections.push(`## Technical Notes`);
      sections.push('');
      sections.push(userStory.technicalNotes);
    }

    // Original Ticket Context
    sections.push('');
    sections.push(`## Original Ticket Context`);
    sections.push('');

    const metadata = [
      `**Ticket ID**: \`${ticketId.slice(0, 8)}\``,
      ticket.type ? `**Type**: ${ticket.type}` : null,
      ticket.severity ? `**Severity**: ${ticket.severity}` : null,
      ticket.status ? `**Status**: ${ticket.status}` : null,
    ].filter(Boolean);

    sections.push(metadata.join(' | '));
    sections.push('');
    sections.push(`---`);
    sections.push(`*Generated from Support Helper ticket as User Story*`);

    return sections.join('\n');
  }

  /**
   * Build labels for the User Story GitHub issue
   */
  private buildLabels(userStory: GeneratedUserStoryDto, ticket: any): string[] {
    const labels: string[] = ['user-story', 'from-ticket'];

    if (ticket.severity) {
      labels.push(`severity:${ticket.severity}`);
    }

    if (ticket.type) {
      labels.push(`type:${ticket.type}`);
    }

    // Add AI-suggested labels that don't duplicate
    for (const label of userStory.labels) {
      if (!labels.includes(label)) {
        labels.push(label);
      }
    }

    return labels;
  }
}

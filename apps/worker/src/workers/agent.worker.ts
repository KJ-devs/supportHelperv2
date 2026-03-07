import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { Octokit } from '@octokit/rest';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '../queues';
import { AgentJobData, AgentResult } from '../queues/queue.types';
import { OpenAIService } from '../services/openai.service';
import { PrismaService } from '../services/prisma.service';
import { MeilisearchService } from '../services/meilisearch.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';
import { buildServiceJwt } from '../utils/jwt.utils';

// Note: AGENT_TOOLS definitions and the multi-turn function calling loop
// are now owned by AgentService.runWithFunctionCalling(). The worker
// delegates tool execution to that method.

/**
 * AgentWorker
 *
 * BullMQ consumer for AI agent orchestration:
 * - Ticket analysis and classification
 * - Solution suggestion based on similar tickets
 * - Automatic responses
 * - Escalation management
 * - GPT-4o function calling for tool use
 *
 * Retry Strategy: Exponential backoff (1min, 5min, 15min, 1hr)
 * Agent jobs get 5 retry attempts (vs 4 for others)
 */
@Processor(QUEUE_NAMES.AGENT_ORCHESTRATION, {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      const delays: number[] = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
      const index = Math.max(0, Math.min(attemptsMade - 1, delays.length - 1));
      return delays[index]!;
    },
  },
})
export class AgentWorker extends WorkerHost {
  private readonly logger = new Logger(AgentWorker.name);
  private redisClient: Redis | null = null;

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly prisma: PrismaService,
    private readonly meilisearch: MeilisearchService,
    private readonly configService: ConfigService,
    @InjectQueue('dead-letter')
    private readonly deadLetterQueue: Queue
  ) {
    super();
  }

  /**
   * Get a Redis client (lazy-initialized, shared across invocations).
   */
  private getRedis(): Redis {
    if (!this.redisClient) {
      const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
      this.redisClient = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
    }
    return this.redisClient;
  }

  /**
   * Get a GitHub App installation access token.
   * Generates a short-lived JWT, exchanges it for an installation token, and
   * caches the result in Redis for 55 minutes (tokens expire after 60 min).
   * This never requires user re-authentication.
   */
  private async getInstallationToken(installationId: number): Promise<string> {
    const cacheKey = `github:installation-token:${installationId}`;

    const cached = await this.getRedis().get(cacheKey);
    if (cached) {
      return cached;
    }

    const appId = this.configService.get<string>('GITHUB_APP_ID');
    const rawPrivateKey = this.configService.get<string>('GITHUB_PRIVATE_KEY');

    if (!appId || !rawPrivateKey) {
      throw new Error(
        'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY env vars.'
      );
    }

    // Normalize line endings (handles escaped \n in env vars)
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

    const now = Math.floor(Date.now() / 1000);
    const appJwt = jwt.sign({ iss: appId, iat: now - 60, exp: now + 540 }, privateKey, {
      algorithm: 'RS256',
    });

    const octokit = new Octokit({ auth: appJwt });
    const { data } = await octokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    // Cache for 55 minutes
    await this.getRedis().set(cacheKey, data.token, 'EX', 55 * 60);

    this.logger.log(`Created installation token for installation ${installationId}`);
    return data.token;
  }

  /**
   * Main processor method - routes to specific handlers based on job type
   */
  async process(job: Job<AgentJobData>): Promise<AgentResult> {
    const { type } = job.data;

    this.logger.log(`Processing agent job ${job.id} of type: ${type}`);

    try {
      switch (type) {
        case 'analyze-ticket':
          return await this.handleAnalyzeTicket(job);

        case 'classify-ticket':
          return await this.handleClassifyTicket(job);

        case 'suggest-solution':
          return await this.handleSuggestSolution(job);

        case 'escalate-ticket':
          return await this.handleEscalateTicket(job);

        case 'create-user-story':
          return await this.handleCreateUserStory(job);

        case 'auto-answer':
          return await this.handleAutoAnswer(job);

        case 'generate-proposal':
          return await this.handleGenerateProposal(job);

        default:
          throw new Error(`Unknown agent job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Agent job failed: ${getErrorMessage(error)}`, getErrorStack(error));
      // Re-throw so BullMQ marks the job as failed, triggers retries and onFailed
      throw error;
    }
  }

  /**
   * Analyze ticket with AI — delegates to the API's DeepAnalysisService
   * via internal HTTP call (same pattern as DeepAnalysisWorker).
   *
   * Previously used the legacy AgentService.runWithFunctionCalling() which
   * ran a separate AI loop in the worker process. Now the API's agentic loop
   * (with retry, context pruning, 16 tools) handles the analysis.
   */
  private async handleAnalyzeTicket(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, sessionId } = job.data;

    this.logger.log(`Analyzing ticket ${ticketId} via API delegation`);
    await job.updateProgress(10);

    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3001';
    const internalSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    const jwtSecret =
      this.configService.get<string>('WORKER_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!internalSecret || !jwtSecret) {
      this.logger.error(
        'INTERNAL_API_SECRET or JWT_SECRET not configured — cannot delegate to API'
      );
      return {
        success: false,
        type: 'analyze-ticket',
        ticketId,
        error: 'Internal auth not configured',
      };
    }

    const serviceJwt = buildServiceJwt(jwtSecret);
    const endpoint = `${apiUrl}/api/agent/v2/internal/analyze`;

    this.logger.log(`Delegating analyze-ticket for ${ticketId} to API: ${endpoint}`);
    await job.updateProgress(20);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
          Authorization: `Bearer ${serviceJwt}`,
        },
        body: JSON.stringify({ ticketId, tenantId }),
      });

      await job.updateProgress(80);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API responded with ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        ticketId: string;
        diagnosisFound: boolean;
        diagnosis: unknown;
      };

      // If session exists, update status while preserving AgentHandoffContext
      // (the API's DeepAnalysisService already wrote n1Analysis into agentState)
      if (sessionId) {
        const nextStatus = result.diagnosisFound ? 'proposing' : 'escalated';
        const session = await this.prisma.agentSession.findUnique({
          where: { id: sessionId },
          select: { agentState: true },
        });
        const existingState = (session?.agentState ?? {}) as Record<string, unknown>;

        await this.prisma.agentSession
          .update({
            where: { id: sessionId },
            data: {
              status: nextStatus,
              // Merge handoff-level status into the existing AgentHandoffContext
              agentState: JSON.parse(
                JSON.stringify({
                  ...existingState,
                  _step: 'n1_complete',
                  _diagnosisFound: result.diagnosisFound,
                })
              ),
            },
          })
          .catch((err: unknown) => {
            this.logger.warn(`Could not update AgentSession ${sessionId}: ${getErrorMessage(err)}`);
          });
      }

      await job.updateProgress(100);

      this.logger.log(
        `Ticket ${ticketId} analyzed via API: diagnosisFound=${result.diagnosisFound}`
      );

      return {
        success: true,
        type: 'analyze-ticket',
        ticketId,
        metadata: { sessionId, diagnosisFound: result.diagnosisFound },
      };
    } catch (error) {
      this.logger.error(`analyze-ticket API delegation failed: ${getErrorMessage(error)}`);
      return {
        success: false,
        type: 'analyze-ticket',
        ticketId,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Classify ticket type and severity
   */
  private async handleClassifyTicket(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId } = job.data;

    this.logger.log(`Classifying ticket ${ticketId}`);
    await job.updateProgress(10);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    await job.updateProgress(30);

    // Quick classification with GPT
    const classification = await this.openaiService.classify({
      text: `${ticket.title}\n\n${ticket.description || ''}\n\n${ticket.aiSummary || ''}`,
      categories: {
        type: [
          'bug',
          'feature_request',
          'question',
          'documentation',
          'performance',
          'security',
          'other',
        ],
        severity: ['critical', 'high', 'medium', 'low'],
      },
    });

    await job.updateProgress(70);

    // Update ticket
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        type: classification.type?.value || null,
        typeConfidence: classification.type?.confidence || null,
        severity: classification.severity?.value || null,
        severityConfidence: classification.severity?.confidence || null,
      },
    });

    await job.updateProgress(100);

    return {
      success: true,
      type: 'classify-ticket',
      ticketId,
      analysis: {
        classification: {
          type: classification.type?.value || 'unknown',
          confidence: classification.type?.confidence || 0,
        },
        severity: {
          level: classification.severity?.value || 'unknown',
          confidence: classification.severity?.confidence || 0,
        },
        keywords: [],
        summary: '',
      },
    };
  }

  /**
   * Suggest solution based on similar tickets
   */
  private async handleSuggestSolution(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId } = job.data;

    this.logger.log(`Suggesting solution for ticket ${ticketId}`);
    await job.updateProgress(10);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { media: true },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    await job.updateProgress(20);

    // Search for similar resolved tickets
    const searchQuery = `${ticket.title} ${ticket.description || ''} ${ticket.aiSummary || ''}`;
    const similarTickets = await this.meilisearch.search('tickets', searchQuery, {
      filter: `tenantId = "${tenantId}" AND status = "resolved"`,
      limit: 5,
    });

    await job.updateProgress(40);

    // Get full details of similar tickets
    const similarTicketDetails = await this.prisma.ticket.findMany({
      where: {
        id: { in: similarTickets.hits.map((h: { id: string }) => h.id) },
      },
    });

    await job.updateProgress(60);

    // Generate solution suggestion
    const response = await this.openaiService.chat({
      messages: [
        {
          role: 'system',
          content: `You are a helpful support assistant. Based on similar resolved tickets, suggest a solution for the current issue. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: `Current ticket:
Title: ${ticket.title}
Description: ${ticket.description}
AI Summary: ${ticket.aiSummary}

Similar resolved tickets:
${similarTicketDetails
  .map(
    (t, i) => `
${i + 1}. ${t.title}
   Summary: ${t.aiSummary}
   Type: ${t.type}
`
  )
  .join('\n')}

Please suggest a solution based on how similar issues were resolved.`,
        },
      ],
    });

    await job.updateProgress(90);

    // Store session
    if (job.data.sessionId) {
      await this.storeAgentSession(ticketId, job.data.sessionId, {
        type: 'suggest-solution',
        similarTickets: similarTickets.hits.map((h: { id: string }) => h.id),
        suggestion: response.content,
      });
    }

    await job.updateProgress(100);

    return {
      success: true,
      type: 'suggest-solution',
      ticketId,
      response: response.content,
      suggestions: [response.content],
    };
  }

  /**
   * Escalate ticket to human
   */
  private async handleEscalateTicket(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId } = job.data;

    this.logger.log(`Escalating ticket ${ticketId}`);
    await job.updateProgress(20);

    // Update ticket status
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'escalated',
        priority: Math.min(
          (await this.prisma.ticket.findUnique({ where: { id: ticketId } }))?.priority || 0 + 1,
          10
        ),
        aiAnalysis: {
          escalatedAt: new Date().toISOString(),
          escalationReason: 'AI determined escalation needed',
        },
      },
    });

    await job.updateProgress(60);

    // Create agent session for escalation
    const sessionId = job.data.sessionId || `escalation-${Date.now()}`;
    await this.storeAgentSession(ticketId, sessionId, {
      type: 'escalation',
      status: 'pending_human',
    });

    await job.updateProgress(100);

    return {
      success: true,
      type: 'escalate-ticket',
      ticketId,
      escalated: true,
      response: 'Ticket has been escalated to human support.',
    };
  }

  /**
   * Generate and create a GitHub User Story from a ticket
   */
  private async handleCreateUserStory(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, context } = job.data;
    const options = context?.userStoryOptions;

    if (!options?.repository) {
      throw new Error('context.userStoryOptions.repository is required for create-user-story');
    }

    this.logger.log(`Creating User Story for ticket ${ticketId}`);
    await job.updateProgress(10);

    // Fetch ticket with full context
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        media: true,
        application: true,
        agentSessions: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 10,
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    await job.updateProgress(20);

    // Build user story generation prompt
    const promptParts: string[] = [
      'You are a product manager. Transform this bug report into a structured GitHub User Story.',
      '',
      '## Ticket Information',
      `Title: ${ticket.title || 'No title'}`,
      `Description: ${ticket.description || 'No description'}`,
    ];

    if (ticket.aiSummary) promptParts.push(`AI Summary: ${ticket.aiSummary}`);
    if (ticket.aiAnalysis) promptParts.push(`AI Analysis: ${JSON.stringify(ticket.aiAnalysis)}`);
    if (ticket.severity) promptParts.push(`Severity: ${ticket.severity}`);
    if (ticket.type) promptParts.push(`Type: ${ticket.type}`);
    if (ticket.reproductionSteps)
      promptParts.push(`Reproduction Steps: ${JSON.stringify(ticket.reproductionSteps)}`);
    if (ticket.keywords?.length) promptParts.push(`Keywords: ${ticket.keywords.join(', ')}`);

    if (ticket.agentSessions?.[0]?.messages?.length) {
      promptParts.push('', '## Agent Conversation');
      for (const msg of ticket.agentSessions[0].messages) {
        promptParts.push(`${msg.role}: ${msg.content}`);
      }
    }

    if (options.additionalContext) {
      promptParts.push('', '## Additional Context', options.additionalContext);
    }

    promptParts.push(
      '',
      '## Instructions',
      'Generate a User Story in JSON:',
      '- title: "As a [user], I want [goal] so that [benefit]"',
      '- description: Detailed description',
      '- acceptanceCriteria: Array of testable criteria',
      '- technicalNotes: Implementation notes',
      '- labels: Suggested GitHub labels',
      '- priority: "low" | "medium" | "high" | "critical"',
      '',
      'Respond ONLY with valid JSON.'
    );

    await job.updateProgress(30);

    // Call OpenAI to generate user story
    const response = await this.openaiService.chat({
      messages: [
        {
          role: 'system',
          content:
            'You are an expert product manager who transforms bug reports into well-structured User Stories. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: promptParts.join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
    });

    await job.updateProgress(50);

    // Parse user story
    let userStory: {
      title: string;
      description: string;
      acceptanceCriteria: string[];
      technicalNotes: string;
      labels: string[];
      priority: string;
    };

    try {
      const parsed = JSON.parse(response.content);
      userStory = {
        title: parsed.title || 'As a user, I want this issue resolved',
        description: parsed.description || '',
        acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria)
          ? parsed.acceptanceCriteria
          : [],
        technicalNotes: parsed.technicalNotes || '',
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        priority: parsed.priority || 'medium',
      };
    } catch {
      throw new Error('Failed to parse User Story from AI response');
    }

    await job.updateProgress(60);

    // Get GitHub App installation for the tenant to obtain a non-expiring token
    const githubInstallation = await this.prisma.githubInstallation.findFirst({
      where: { tenantId },
    });

    if (!githubInstallation) {
      throw new Error('GitHub App not installed for this tenant');
    }

    const userStoryToken = await this.getInstallationToken(
      Number(githubInstallation.installationId)
    );

    // Format GitHub issue body
    const bodySections: string[] = [
      `## User Story\n\n**${userStory.title}**`,
      `## Description\n\n${userStory.description}`,
    ];

    if (userStory.acceptanceCriteria.length > 0) {
      const criteria = userStory.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n');
      bodySections.push(`## Acceptance Criteria\n\n${criteria}`);
    }

    if (userStory.technicalNotes) {
      bodySections.push(`## Technical Notes\n\n${userStory.technicalNotes}`);
    }

    const metadata = [
      `**Ticket ID**: \`${ticketId.slice(0, 8)}\``,
      ticket.type ? `**Type**: ${ticket.type}` : null,
      ticket.severity ? `**Severity**: ${ticket.severity}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    bodySections.push(
      `## Original Ticket Context\n\n${metadata}\n\n---\n*Generated from Support Helper ticket as User Story*`
    );

    const issueBody = bodySections.join('\n\n');

    // Build labels
    const labels: string[] = ['user-story', 'from-ticket'];
    if (ticket.severity) labels.push(`severity:${ticket.severity}`);
    if (ticket.type) labels.push(`type:${ticket.type}`);
    for (const label of userStory.labels) {
      if (!labels.includes(label)) labels.push(label);
    }

    await job.updateProgress(70);

    // Create GitHub issue
    const octokit = new Octokit({ auth: userStoryToken });
    const [owner = '', repo = ''] = options.repository.split('/');

    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected "owner/repo"');
    }

    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: userStory.title,
      body: issueBody,
      labels,
      assignees: options.assignees,
      milestone: options.milestone,
    });

    await job.updateProgress(85);

    // Save link in GithubIssue table
    await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubIssueNumber: issue.number,
        githubRepo: options.repository,
        githubIssueUrl: issue.html_url,
        syncStatus: 'user-story',
        lastSyncedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    this.logger.log(
      `Created User Story issue #${issue.number} for ticket ${ticketId} in ${options.repository}`
    );

    return {
      success: true,
      type: 'create-user-story',
      ticketId,
      response: `Created User Story issue #${issue.number}: ${userStory.title}`,
      metadata: {
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        repository: options.repository,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Shared Helpers (logging, error handling)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Append a log entry to an agent task's execution log.
   *
   * Calls the API's internal endpoint so that:
   * 1. The DB write happens through AgentTasksService.appendLog()
   * 2. An 'agent-task:log-appended' EventEmitter event is fired
   * 3. AgentTasksGateway broadcasts 'task:log-appended' to all WS subscribers
   *
   * Falls back to direct Prisma write if internal auth env vars are missing
   * (e.g., local dev without INTERNAL_API_SECRET configured).
   */
  private async appendAgentTaskLog(agentTaskId: string, entry: Record<string, any>): Promise<void> {
    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3001';
    const internalSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    const jwtSecret =
      this.configService.get<string>('WORKER_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (internalSecret && jwtSecret) {
      try {
        const serviceJwt = buildServiceJwt(jwtSecret);
        const endpoint = `${apiUrl}/api/v1/agent-tasks/internal/${agentTaskId}/log`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret,
            Authorization: `Bearer ${serviceJwt}`,
          },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          const body = await response.text();
          this.logger.warn(
            `appendAgentTaskLog API call failed (${response.status}): ${body} — falling back to direct Prisma write`
          );
          // Fall through to Prisma fallback below
        } else {
          return;
        }
      } catch (error) {
        this.logger.warn(
          `appendAgentTaskLog API call error: ${getErrorMessage(error)} — falling back to direct Prisma write`
        );
      }
    }

    // Fallback: write directly to Prisma (no WS event will be emitted)
    try {
      const task = await this.prisma.agentTask.findUnique({
        where: { id: agentTaskId },
        select: { executionLog: true },
      });

      const currentLog = (task?.executionLog as Record<string, any>[]) || [];
      const updatedLog = [...currentLog, { ...entry, timestamp: new Date().toISOString() }];

      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: { executionLog: updatedLog },
      });
    } catch (error) {
      this.logger.warn(`Failed to append agent task log: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Set error on an agent task and update status to failed.
   */
  private async setAgentTaskError(agentTaskId: string, error: string): Promise<void> {
    try {
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: {
          error,
          status: 'failed',
          completedAt: new Date(),
        },
      });
      await this.appendAgentTaskLog(agentTaskId, { step: 'error', message: error });
    } catch (err) {
      this.logger.error(`Failed to set agent task error: ${getErrorMessage(err)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Store agent session
   */
  private async storeAgentSession(
    ticketId: string,
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const existingSession = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (existingSession) {
      // Update existing session - store in agentState
      const currentState = (existingSession.agentState as Record<string, unknown>) || {};
      const messages = Array.isArray(currentState.messages) ? currentState.messages : [];

      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          agentState: JSON.parse(
            JSON.stringify({
              ...currentState,
              messages: [...messages, data],
            })
          ),
          lastActionAt: new Date(),
        },
      });
    } else {
      // Create new session
      await this.prisma.agentSession.create({
        data: {
          id: sessionId,
          ticketId,
          status: 'active',
          agentState: JSON.parse(
            JSON.stringify({
              messages: [data],
              context: {},
            })
          ),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Auto-Answer Handler (Question tickets — RAG-based response)
  // ═══════════════════════════════════════════════════════════════════════

  private async handleAutoAnswer(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, applicationId } = job.data;

    this.logger.log(`Auto-answering question ticket ${ticketId}`);
    await job.updateProgress(10);

    // Load ticket
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        aiSummary: true,
        keywords: true,
      },
    });

    if (!ticket) {
      return { success: false, type: 'auto-answer', ticketId, error: 'Ticket not found' };
    }

    await job.updateProgress(20);

    // Search for similar resolved tickets
    const searchText = ticket.title || ticket.description || '';
    const similarTickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        id: { not: ticketId },
        status: { in: ['resolved', 'closed'] },
        type: 'question',
        OR: [{ title: { contains: searchText.slice(0, 50), mode: 'insensitive' } }],
      },
      select: { title: true, description: true, aiSummary: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    await job.updateProgress(40);

    // Search codebase embeddings for relevant context (if indexed)
    let codeContext = '';
    if (applicationId) {
      try {
        const embeddings = await this.prisma.codebaseEmbedding.findMany({
          where: { applicationId },
          select: { filePath: true, content: true },
          take: 5,
          orderBy: { updatedAt: 'desc' },
        });
        if (embeddings.length > 0) {
          codeContext =
            '\n\n## Relevant Code Context\n' +
            embeddings.map(e => `### ${e.filePath}\n${e.content.slice(0, 500)}`).join('\n\n');
        }
      } catch {
        // Codebase not indexed, skip
      }
    }

    await job.updateProgress(60);

    // Build prompt and generate answer
    const similarContext =
      similarTickets.length > 0
        ? '\n\n## Similar Resolved Questions\n' +
          similarTickets
            .map(
              t =>
                `- Q: "${t.title}"\n  A: ${t.aiSummary || t.description?.slice(0, 200) || 'No summary'}`
            )
            .join('\n')
        : '';

    const systemPrompt = `You are a helpful technical support agent. A user has asked a question about their application. Based on the codebase documentation and similar resolved tickets provided below, generate a clear, actionable answer.

If you cannot confidently answer the question from the provided context, say so and suggest that the user provide more details or that the ticket will be reviewed by a human.

Be concise but thorough. Include code snippets or file references when relevant.`;

    const userPrompt = `## User's Question
Title: ${ticket.title || 'No title'}
Description: ${ticket.description || 'No description'}
${ticket.aiSummary ? `\nAI Summary: ${ticket.aiSummary}` : ''}${similarContext}${codeContext}

Please answer this question.`;

    let answer: string;
    try {
      const chatResult = await this.openaiService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });
      answer = chatResult.content || 'No response generated.';
    } catch (error) {
      this.logger.error(`Auto-answer AI call failed: ${getErrorMessage(error)}`);
      answer =
        'I was unable to generate an automatic answer. A human support agent will review your question.';
    }

    await job.updateProgress(80);

    // Save answer as a TicketMessage
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        type: 'agent',
        content: answer,
        sender: 'triage-agent',
        metadata: {
          handler: 'auto-answer',
          similarTicketsUsed: similarTickets.length,
          hasCodeContext: codeContext.length > 0,
        },
      },
    });

    // Update ticket status
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'waiting_response' },
    });

    // Record timeline event
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'auto_answer_generated',
        data: {
          responseLength: answer.length,
          similarTicketsUsed: similarTickets.length,
          hasCodeContext: codeContext.length > 0,
        },
      },
    });

    await job.updateProgress(100);

    this.logger.log(`Auto-answer generated for ticket ${ticketId} (${answer.length} chars)`);

    return {
      success: true,
      type: 'auto-answer',
      ticketId,
      response: answer,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Generate Proposal Handler (Feature request tickets)
  // ═══════════════════════════════════════════════════════════════════════

  private async handleGenerateProposal(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, applicationId } = job.data;

    this.logger.log(`Generating technical proposal for feature request ticket ${ticketId}`);
    await job.updateProgress(10);

    // Load ticket
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        aiSummary: true,
        keywords: true,
      },
    });

    if (!ticket) {
      return { success: false, type: 'generate-proposal', ticketId, error: 'Ticket not found' };
    }

    await job.updateProgress(20);

    // Get codebase context if available
    let codeContext = '';
    if (applicationId) {
      try {
        const embeddings = await this.prisma.codebaseEmbedding.findMany({
          where: { applicationId },
          select: { filePath: true, content: true, language: true },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        });
        if (embeddings.length > 0) {
          codeContext =
            '\n\n## Current Codebase Structure\n' +
            embeddings.map(e => `- ${e.filePath} (${e.language || 'unknown'})`).join('\n');
        }
      } catch {
        // Codebase not indexed
      }
    }

    await job.updateProgress(40);

    const systemPrompt = `You are a senior software architect reviewing a feature request for a technical platform. Generate a structured technical proposal.

Your proposal must be in JSON format matching this schema:
{
  "summary": "2-3 sentence overview of the feature",
  "approach": "Detailed technical approach description",
  "affectedAreas": ["list", "of", "code areas/modules"],
  "estimatedComplexity": "small" | "medium" | "large",
  "dependencies": ["external dependencies or prerequisites"],
  "risks": ["potential risks or concerns"],
  "alternatives": ["alternative approaches considered"]
}

Be specific and actionable. Reference actual code areas if codebase context is provided.`;

    const userPrompt = `## Feature Request
Title: ${ticket.title || 'No title'}
Description: ${ticket.description || 'No description'}
${ticket.aiSummary ? `\nAI Summary: ${ticket.aiSummary}` : ''}
${ticket.keywords.length > 0 ? `\nKeywords: ${ticket.keywords.join(', ')}` : ''}${codeContext}

Generate a technical proposal for this feature request.`;

    interface TechnicalProposal {
      summary?: string;
      approach?: string;
      affectedAreas?: string[];
      estimatedComplexity?: string;
      dependencies?: string[];
      risks?: string[];
      alternatives?: string[];
    }

    let proposalText: string;
    let proposalData: TechnicalProposal | null = null;

    try {
      const chatResult = await this.openaiService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      proposalText = chatResult.content || 'No response generated.';

      // Try to parse JSON from the response
      try {
        const jsonMatch = proposalText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          proposalData = JSON.parse(jsonMatch[0]) as TechnicalProposal;
        }
      } catch {
        // Response wasn't valid JSON, use as plain text
      }
    } catch (error) {
      this.logger.error(`Proposal generation AI call failed: ${getErrorMessage(error)}`);
      proposalText =
        'Unable to generate an automatic proposal. A human will review this feature request.';
    }

    await job.updateProgress(80);

    // Save proposal as a TicketMessage
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        type: 'agent',
        content: proposalData
          ? `## Technical Proposal\n\n**Summary:** ${proposalData.summary || ''}\n\n**Approach:** ${proposalData.approach || ''}\n\n**Complexity:** ${proposalData.estimatedComplexity || 'unknown'}\n\n**Affected Areas:** ${(proposalData.affectedAreas || []).join(', ')}\n\n**Risks:** ${(proposalData.risks || []).join(', ')}`
          : proposalText,
        sender: 'triage-agent',
        metadata: JSON.parse(
          JSON.stringify({
            handler: 'generate-proposal',
            proposal: proposalData,
            hasCodeContext: codeContext.length > 0,
          })
        ),
      },
    });

    // Record timeline event
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'proposal_generated',
        data: {
          complexity: proposalData?.estimatedComplexity || 'unknown',
          affectedAreas: proposalData?.affectedAreas || [],
          hasCodeContext: codeContext.length > 0,
        },
      },
    });

    await job.updateProgress(100);

    this.logger.log(`Technical proposal generated for ticket ${ticketId}`);

    return {
      success: true,
      type: 'generate-proposal',
      ticketId,
      response: proposalText,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job<AgentJobData>) {
    this.logger.log(
      `Job ${job.id} started processing (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AgentJobData>, result: AgentResult) {
    this.logger.log(`Job ${job.id} completed successfully - ${result.type}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AgentJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without job context: ${error.message}`);
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 5;

    this.logger.error(
      `Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${getErrorMessage(error)}`,
      getErrorStack(error)
    );

    const agentTaskId = job.data.agentTaskId;

    // If this was the last attempt, mark agentTask as failed and move to dead letter queue
    if (attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} exceeded max retries - moving to dead letter queue`);

      // Mark the agentTask as failed so the dashboard shows the correct status
      if (agentTaskId) {
        await this.setAgentTaskError(
          agentTaskId,
          `Job failed after ${maxAttempts} attempts: ${error.message}`
        );
      }

      await this.deadLetterQueue.add(
        'failed-agent-orchestration',
        {
          originalJobId: job.id,
          queueName: QUEUE_NAMES.AGENT_ORCHESTRATION,
          jobData: job.data,
          failedReason: error.message,
          stacktrace: error.stack,
          attemptsMade,
          timestamp: new Date().toISOString(),
        },
        {
          removeOnComplete: {
            age: 90 * 24 * 60 * 60, // 90 days
          },
        }
      );
    } else {
      const nextDelay = this.getNextRetryDelay(attemptsMade);
      this.logger.warn(`Job ${job.id} will retry in ${Math.round(nextDelay / 1000)}s`);
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Agent job ${jobId} stalled - will be retried automatically`);
  }

  /**
   * Calculate next retry delay based on attempt number
   */
  private getNextRetryDelay(attemptsMade: number): number {
    const delays: number[] = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
    const index = Math.max(0, Math.min(attemptsMade, delays.length - 1));
    return delays[index]!;
  }
}

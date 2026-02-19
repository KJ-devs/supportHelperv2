import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { createDecipheriv } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { QUEUE_NAMES } from '../queues';
import {
  AgentJobData,
  AgentResult,
  TicketAnalysis,
  FunctionCallResult,
} from '../queues/queue.types';
import { OpenAIService } from '../services/openai.service';
import { PrismaService } from '../services/prisma.service';
import { MeilisearchService } from '../services/meilisearch.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';
import { AgentService } from '../services/agent.service';
import { GitAutomationService } from '../services/git-automation.service';
import { PullRequestService } from '../services/pull-request.service';


/** Typed representation of the action plan stored in agentTask.actionPlan (Prisma JSON) */
interface ActionPlan {
  summary: string;
  rootCause: string;
  files: Array<{
    filePath: string;
    operation: 'modify' | 'create' | 'delete';
    description: string;
    changeType: string;
    order?: number;
  }>;
  testingStrategy?: string;
  risks?: string[];
  estimatedComplexity: string;
}

/** Typed representation of settings stored in ProjectGithubConfig.settings (Prisma JSON) */
interface GitSettings {
  branchFormat?: string;
  commitAuthor?: { name?: string; email?: string };
  reviewers?: string[];
  autoLabel?: boolean;
  agentMode?: string;
}

/** Typed log entry stored in agentTask.executionLog (Prisma JSON) */
interface ExecutionLogEntry {
  step: string;
  timestamp?: string;
  message?: string;
  files?: Array<{ filePath: string; content: string; operation: 'modify' | 'create' | 'delete' }>;
  [key: string]: unknown;
}

/**
 * Agent Function Tools for GPT-4o function calling
 */
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_similar_tickets',
      description: 'Search for similar tickets in the knowledge base',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find similar tickets',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ticket_details',
      description: 'Get full details of a specific ticket',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The ID of the ticket to retrieve',
          },
        },
        required: ['ticketId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_ticket_status',
      description: 'Update the status of a ticket',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The ID of the ticket to update',
          },
          status: {
            type: 'string',
            enum: ['new', 'open', 'in_progress', 'resolved', 'closed'],
            description: 'The new status for the ticket',
          },
        },
        required: ['ticketId', 'status'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'escalate_to_human',
      description: 'Escalate the ticket to a human support agent',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The ID of the ticket to escalate',
          },
          reason: {
            type: 'string',
            description: 'The reason for escalation',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'The priority level for escalation',
          },
        },
        required: ['ticketId', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_solution',
      description: 'Suggest a solution based on similar resolved tickets',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'The ID of the ticket to suggest a solution for',
          },
          similarTicketIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of similar tickets to base the suggestion on',
          },
        },
        required: ['ticketId'],
      },
    },
  },
];

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

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly prisma: PrismaService,
    private readonly meilisearch: MeilisearchService,
    private readonly agentService: AgentService,
    private readonly configService: ConfigService,
    private readonly gitAutomationService: GitAutomationService,
    private readonly pullRequestService: PullRequestService,
    @InjectQueue('dead-letter')
    private readonly deadLetterQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_ORCHESTRATION)
    private readonly agentQueue: Queue,
  ) {
    super();
  }

  /**
   * Main processor method - routes to specific handlers based on job type
   */
  async process(job: Job<AgentJobData>): Promise<AgentResult> {
    const { type, ticketId } = job.data;

    this.logger.log(`Processing agent job ${job.id} of type: ${type}`);

    try {
      switch (type) {
        case 'start-session':
          return await this.handleStartSession(job);

        case 'process-message':
          return await this.handleProcessMessage(job);

        case 'analyze-ticket':
          return await this.handleAnalyzeTicket(job);

        case 'classify-ticket':
          return await this.handleClassifyTicket(job);

        case 'suggest-solution':
          return await this.handleSuggestSolution(job);

        case 'auto-respond':
          return await this.handleAutoRespond(job);

        case 'escalate-ticket':
          return await this.handleEscalateTicket(job);

        case 'create-user-story':
          return await this.handleCreateUserStory(job);

        case 'generate-action-plan':
          return await this.handleGenerateActionPlan(job);

        case 'generate-code':
          return await this.handleGenerateCode(job);

        case 'push-code':
          return await this.handlePushCode(job);

        default:
          throw new Error(`Unknown agent job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Agent job failed: ${getErrorMessage(error)}`, getErrorStack(error));
      return {
        success: false,
        type,
        ticketId: ticketId || '',
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Start a new agent session with full state machine processing
   * This is the main entry point for Phase 4 Agent Processing
   */
  private async handleStartSession(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId } = job.data;

    this.logger.log(`Starting agent session for ticket ${ticketId}`);
    await job.updateProgress(10);

    try {
      // Start the agent session - this triggers the full state machine
      const session = await this.agentService.startSession(ticketId, tenantId);

      await job.updateProgress(100);

      return {
        success: true,
        type: 'start-session',
        ticketId,
        response: `Agent session ${session.id} started in state ${session.state}`,
        metadata: {
          sessionId: session.id,
          state: session.state,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to start agent session: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Process an incoming user message in an existing session
   */
  private async handleProcessMessage(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, sessionId, context } = job.data;

    if (!sessionId) {
      throw new Error('sessionId is required for process-message');
    }

    const message = context?.message;
    const channel = context?.channel || 'chat';

    if (!message) {
      throw new Error('context.message is required for process-message');
    }

    this.logger.log(`Processing message for session ${sessionId}`);
    await job.updateProgress(10);

    try {
      // Handle the user message - this will trigger state transitions
      await this.agentService.handleUserMessage(sessionId, message, channel);

      await job.updateProgress(80);

      // Get updated session status
      const status = await this.agentService.getSessionStatus(sessionId);

      await job.updateProgress(100);

      return {
        success: true,
        type: 'process-message',
        ticketId,
        response: `Message processed, session in state ${status.state}`,
        metadata: {
          sessionId,
          state: status.state,
          confidence: status.confidence,
          attempts: status.attempts,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to process message: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Analyze ticket with AI - extract insights and classify
   */
  private async handleAnalyzeTicket(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId } = job.data;

    this.logger.log(`Analyzing ticket ${ticketId}`);
    await job.updateProgress(10);

    // Get ticket with all related data
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        media: {
          include: {
            videoEvents: true,
          },
        },
        application: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    await job.updateProgress(20);

    // Build analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(ticket);

    // Run GPT-4o analysis with function calling
    const response = await this.openaiService.chat({
      messages: [
        {
          role: 'system',
          content: `You are an expert technical support AI assistant. Analyze the following ticket and provide:
1. A clear classification of the issue type
2. An assessment of the severity
3. Key keywords for search
4. A concise summary
5. Extracted reproduction steps if available

Be precise and structured in your analysis.`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      tools: AGENT_TOOLS,
      response_format: { type: 'json_object' },
    });

    await job.updateProgress(60);

    // Process function calls if any
    const functionCalls = await this.processFunctionCalls(response.tool_calls || [], tenantId);

    // Parse analysis result
    const analysis = this.parseAnalysisResponse(response.content);

    await job.updateProgress(80);

    // Update ticket with analysis
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        type: analysis.classification.type,
        typeConfidence: analysis.classification.confidence,
        severity: analysis.severity.level,
        severityConfidence: analysis.severity.confidence,
        keywords: analysis.keywords,
        aiSummary: analysis.summary,
        aiAnalysis: JSON.parse(
          JSON.stringify({
            ...((ticket.aiAnalysis as Record<string, unknown>) || {}),
            agentAnalysis: analysis,
            analyzedAt: new Date().toISOString(),
          })
        ),
        reproductionSteps: analysis.reproductionSteps,
      },
    });

    await job.updateProgress(100);

    this.logger.log(`Ticket ${ticketId} analyzed: ${analysis.classification.type}`);

    return {
      success: true,
      type: 'analyze-ticket',
      ticketId,
      analysis,
      functionCalls,
    };
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
   * Generate automatic response
   */
  private async handleAutoRespond(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, context } = job.data;

    this.logger.log(`Generating auto-response for ticket ${ticketId}`);
    await job.updateProgress(10);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        application: true,
        reporter: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    await job.updateProgress(30);

    // Build conversation history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `You are a helpful support assistant for ${ticket.application?.name || 'the application'}. 
Respond professionally and helpfully to user issues.
If you cannot solve the issue, acknowledge it and let them know a human will follow up.
Keep responses concise but thorough.`,
      },
    ];

    // Add context messages if provided
    if (context?.previousMessages) {
      messages.push(...context.previousMessages);
    }

    // Add current ticket as user message
    messages.push({
      role: 'user',
      content: `Issue: ${ticket.title}\n\nDetails: ${ticket.description || 'No additional details provided.'}\n\nAI Analysis: ${ticket.aiSummary || 'Analysis pending.'}`,
    });

    await job.updateProgress(50);

    // Generate response with function calling
    const response = await this.openaiService.chat({
      messages,
      tools: AGENT_TOOLS,
    });

    // Process any function calls
    const functionCalls = await this.processFunctionCalls(response.tool_calls || [], tenantId);

    await job.updateProgress(80);

    // Store agent session
    const sessionId = job.data.sessionId || `session-${Date.now()}`;
    await this.storeAgentSession(ticketId, sessionId, {
      type: 'auto-respond',
      response: response.content,
      functionCalls,
    });

    await job.updateProgress(100);

    return {
      success: true,
      type: 'auto-respond',
      ticketId,
      response: response.content,
      functionCalls,
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
    if (ticket.reproductionSteps) promptParts.push(`Reproduction Steps: ${JSON.stringify(ticket.reproductionSteps)}`);
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
      'Respond ONLY with valid JSON.',
    );

    await job.updateProgress(30);

    // Call OpenAI to generate user story
    const response = await this.openaiService.chat({
      messages: [
        {
          role: 'system',
          content: 'You are an expert product manager who transforms bug reports into well-structured User Stories. Always respond with valid JSON.',
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
        acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
        technicalNotes: parsed.technicalNotes || '',
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        priority: parsed.priority || 'medium',
      };
    } catch {
      throw new Error('Failed to parse User Story from AI response');
    }

    await job.updateProgress(60);

    // Get GitHub connection for the tenant
    const connection = await this.prisma.githubConnection.findFirst({
      where: { tenantId },
    });

    if (!connection || !connection.accessToken) {
      throw new Error('GitHub not connected for this tenant');
    }

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
    ].filter(Boolean).join(' | ');

    bodySections.push(`## Original Ticket Context\n\n${metadata}\n\n---\n*Generated from Support Helper ticket as User Story*`);

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
    const octokit = new Octokit({ auth: connection.accessToken });
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
      `Created User Story issue #${issue.number} for ticket ${ticketId} in ${options.repository}`,
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
  // Code Analysis: Generate Action Plan (US-3.2)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate a code-level action plan for a ticket.
   * Fetches ticket + codebase context, calls Claude, and stores the plan.
   */
  private async handleGenerateActionPlan(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, applicationId, agentTaskId } = job.data;

    if (!agentTaskId || !applicationId) {
      throw new Error('agentTaskId and applicationId are required for generate-action-plan');
    }

    this.logger.log(`Generating action plan for ticket ${ticketId} (task ${agentTaskId})`);
    await job.updateProgress(5);

    // 1. Update status to analyzing and log start
    await this.prisma.agentTask.update({
      where: { id: agentTaskId },
      data: { status: 'analyzing' },
    });
    await this.appendAgentTaskLog(agentTaskId, {
      step: 'started',
      message: 'Starting ticket analysis',
    });

    await job.updateProgress(10);

    // 2. Fetch ticket with application + githubConfig + installation
    const agentTask = await this.prisma.agentTask.findUnique({
      where: { id: agentTaskId },
      include: {
        ticket: {
          include: {
            application: {
              include: {
                githubConfig: {
                  include: {
                    installation: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!agentTask) {
      throw new Error(`Agent task ${agentTaskId} not found`);
    }

    const { ticket } = agentTask;
    const githubConfig = ticket.application?.githubConfig;

    if (!githubConfig) {
      await this.setAgentTaskError(agentTaskId, 'No GitHub configuration found for this application. Link a repository first.');
      throw new Error('No GitHub configuration found for application');
    }

    await this.appendAgentTaskLog(agentTaskId, {
      step: 'ticket_loaded',
      message: `Loaded ticket "${ticket.title}" with repo ${githubConfig.owner}/${githubConfig.repo}`,
    });

    await job.updateProgress(20);

    // 3. Check if codebase is indexed
    const indexStatus = await this.prisma.codebaseIndexStatus.findUnique({
      where: { applicationId },
    });

    if (!indexStatus || indexStatus.status !== 'indexed') {
      this.logger.warn(`Codebase not indexed for application ${applicationId}, continuing with limited context`);
      await this.appendAgentTaskLog(agentTaskId, {
        step: 'codebase_index_warning',
        message: 'Codebase not fully indexed. Analysis may be less accurate.',
      });
    }

    await job.updateProgress(30);

    // 4. Search relevant code via pgvector RAG
    const relevantCode = await this.searchCodebaseEmbeddings(applicationId, ticket);
    await this.appendAgentTaskLog(agentTaskId, {
      step: 'code_search',
      message: `Found ${relevantCode.length} relevant code snippets`,
    });

    await job.updateProgress(40);

    // 5. Get repo tree via GitHub API
    const repoTree = await this.getRepoTreeForActionPlan(
      tenantId,
      Number(githubConfig.installation.installationId),
      githubConfig.owner,
      githubConfig.repo,
    );
    await this.appendAgentTaskLog(agentTaskId, {
      step: 'repo_tree',
      message: `Retrieved repo tree with ${repoTree.length} files`,
    });

    await job.updateProgress(50);

    // 6. Get Anthropic API key for the tenant
    const anthropicApiKey = await this.getDecryptedAnthropicKey(tenantId);
    if (!anthropicApiKey) {
      await this.setAgentTaskError(agentTaskId, 'No Anthropic API key configured for this tenant.');
      throw new Error('No Anthropic API key configured');
    }

    // Get configured model
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });
    const model = aiConfig?.model || 'claude-sonnet-4-20250514';

    await this.appendAgentTaskLog(agentTaskId, {
      step: 'ai_configured',
      message: `Using model ${model}`,
    });

    await job.updateProgress(60);

    // 7. Build prompts and call Claude
    const systemPrompt = this.buildActionPlanSystemPrompt();
    const userPrompt = this.buildActionPlanUserPrompt(ticket, repoTree, relevantCode);

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    this.logger.log(`Calling Claude (${model}) for action plan generation`);
    await this.appendAgentTaskLog(agentTaskId, {
      step: 'calling_claude',
      message: 'Sending analysis request to Claude',
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    await job.updateProgress(80);

    // 8. Parse action plan from response
    const textBlock = response.content.find(
      (block: { type: string }) => block.type === 'text',
    ) as { type: 'text'; text: string } | undefined;
    if (!textBlock) {
      await this.setAgentTaskError(agentTaskId, 'Claude returned an unexpected response format');
      throw new Error('No text block in Claude response');
    }

    const actionPlan = this.parseActionPlanResponse(textBlock.text);

    await this.appendAgentTaskLog(agentTaskId, {
      step: 'plan_parsed',
      message: `Action plan: ${actionPlan.files.length} files, complexity: ${actionPlan.estimatedComplexity}`,
    });

    await job.updateProgress(90);

    // 9. Check validation mode to determine next status
    const needsPlanReview = await this.shouldWaitForReview(applicationId!, 'plan');

    if (needsPlanReview) {
      // Set to plan_pending_review and wait for human approval
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: {
          actionPlan: JSON.parse(JSON.stringify(actionPlan)),
          status: 'plan_pending_review',
          reviewRequestedAt: new Date(),
        },
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'completed',
        message: 'Action plan generated. Waiting for human review before proceeding.',
      });

      this.logger.log(`Action plan for task ${agentTaskId} requires review (plan_pending_review)`);
    } else {
      // Auto mode: set plan_ready, then auto-approve and queue code generation
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: {
          actionPlan: JSON.parse(JSON.stringify(actionPlan)),
          status: 'plan_approved',
        },
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'completed',
        message: 'Action plan generated and auto-approved (auto mode). Proceeding to code generation.',
      });

      // Auto-queue code generation
      await this.agentQueue.add(
        'generate-code',
        {
          type: 'generate-code' as const,
          ticketId,
          tenantId,
          applicationId,
          agentTaskId,
        },
        {
          priority: 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30000 },
        },
      );

      this.logger.log(`Action plan auto-approved for task ${agentTaskId}, code generation queued`);
    }

    await job.updateProgress(100);

    this.logger.log(`Action plan ready for agent task ${agentTaskId}: ${actionPlan.files.length} files`);

    return {
      success: true,
      type: 'generate-action-plan',
      ticketId,
      response: actionPlan.summary,
      metadata: {
        agentTaskId,
        filesCount: actionPlan.files.length,
        complexity: actionPlan.estimatedComplexity,
        needsReview: needsPlanReview,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Code Generation: Generate Code, Create Branch & PR (US-3.3)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate code changes for an approved action plan, create a branch, commit, and open a PR.
   */
  private async handleGenerateCode(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, applicationId, agentTaskId } = job.data;

    if (!agentTaskId || !applicationId) {
      throw new Error('agentTaskId and applicationId are required for generate-code');
    }

    this.logger.log(`Generating code for ticket ${ticketId} (task ${agentTaskId})`);
    await job.updateProgress(5);

    // 1. Set status to generating
    await this.prisma.agentTask.update({
      where: { id: agentTaskId },
      data: { status: 'generating' },
    });
    await this.appendAgentTaskLog(agentTaskId, {
      step: 'started',
      message: 'Starting code generation',
    });

    try {
      await job.updateProgress(10);

      // 2. Load full context: AgentTask -> Ticket -> Application -> ProjectGithubConfig -> GithubInstallation
      const agentTask = await this.prisma.agentTask.findUnique({
        where: { id: agentTaskId },
        include: {
          ticket: {
            include: {
              application: {
                include: {
                  githubConfig: {
                    include: {
                      installation: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!agentTask) {
        throw new Error(`Agent task ${agentTaskId} not found`);
      }

      const { ticket } = agentTask;
      const githubConfig = ticket.application?.githubConfig;

      if (!githubConfig) {
        await this.setAgentTaskError(agentTaskId, 'No GitHub configuration found for this application.');
        throw new Error('No GitHub configuration found for application');
      }

      // 3. Get action plan from agentTask
      const actionPlan = agentTask.actionPlan as unknown as ActionPlan | null;
      if (!actionPlan?.files?.length) {
        await this.setAgentTaskError(agentTaskId, 'No action plan files found. Generate an action plan first.');
        throw new Error('No action plan files found');
      }

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'context_loaded',
        message: `Loaded ticket "${ticket.title}" with ${actionPlan.files.length} files to process`,
      });

      await job.updateProgress(15);

      // 4. Get Octokit client via installation token
      const { owner, repo, defaultBranch } = githubConfig;
      const connection = await this.prisma.githubConnection.findFirst({
        where: {
          tenantId,
          installationId: BigInt(githubConfig.installation.installationId),
        },
      });

      if (!connection?.accessToken) {
        await this.setAgentTaskError(agentTaskId, 'No GitHub access token found. Reconnect GitHub.');
        throw new Error('No GitHub access token found');
      }

      const octokit = new Octokit({ auth: connection.accessToken });

      // 5. Get Anthropic API key
      const anthropicApiKey = await this.getDecryptedAnthropicKey(tenantId);
      if (!anthropicApiKey) {
        await this.setAgentTaskError(agentTaskId, 'No Anthropic API key configured for this tenant.');
        throw new Error('No Anthropic API key configured');
      }

      const aiConfig = await this.prisma.aiConfig.findUnique({
        where: { tenantId },
      });
      const model = aiConfig?.model || 'claude-sonnet-4-20250514';

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'ai_configured',
        message: `Using model ${model}`,
      });

      await job.updateProgress(20);

      // 6. Generate code for each file
      const sortedFiles = [...actionPlan.files].sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0),
      );
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const generatedFiles: Array<{
        filePath: string;
        content: string;
        operation: 'modify' | 'create' | 'delete';
      }> = [];
      let apiCallCount = 0;
      const maxApiCalls = 10;

      const systemPrompt = this.buildCodeGenSystemPrompt();

      for (const file of sortedFiles) {
        if (apiCallCount >= maxApiCalls) {
          await this.appendAgentTaskLog(agentTaskId, {
            step: 'rate_limit',
            message: `Reached maximum API calls (${maxApiCalls}). Stopping code generation.`,
          });
          break;
        }

        // Skip deletion — just mark for tree entry later
        if (file.operation === 'delete') {
          generatedFiles.push({
            filePath: file.filePath,
            content: '',
            operation: 'delete',
          });
          await this.appendAgentTaskLog(agentTaskId, {
            step: 'file_delete',
            message: `Marked ${file.filePath} for deletion`,
          });
          continue;
        }

        // Fetch current content for modifications
        let currentContent = '';
        if (file.operation === 'modify') {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner,
              repo,
              path: file.filePath,
              ref: defaultBranch,
            });

            if ('content' in fileData && fileData.content) {
              currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
            }
          } catch (error) {
            this.logger.warn(`Could not fetch ${file.filePath}: ${getErrorMessage(error)}`);
            await this.appendAgentTaskLog(agentTaskId, {
              step: 'file_fetch_warning',
              message: `Could not fetch current content for ${file.filePath}, treating as new file`,
            });
          }
        }

        // Search relevant code context via pgvector
        const codeContext = await this.searchCodebaseEmbeddings(applicationId, {
          title: file.description,
          description: file.filePath,
          aiSummary: null,
        });

        // Build prompt and call Claude, including CI error context for retries
        const userPrompt = this.buildCodeGenUserPrompt(file, currentContent, codeContext, actionPlan, agentTask.ciErrorLog);

        apiCallCount++;
        this.logger.log(`Calling Claude for file ${file.filePath} (${apiCallCount}/${maxApiCalls})`);

        const response = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const textBlock = response.content.find(
          (block: { type: string }) => block.type === 'text',
        ) as { type: 'text'; text: string } | undefined;

        if (!textBlock) {
          this.logger.warn(`No text response for ${file.filePath}, skipping`);
          continue;
        }

        const generatedCode = this.extractCodeFromResponse(textBlock.text);
        generatedFiles.push({
          filePath: file.filePath,
          content: generatedCode,
          operation: file.operation,
        });

        await this.appendAgentTaskLog(agentTaskId, {
          step: 'file_generated',
          message: `Generated code for ${file.filePath} (${generatedCode.length} chars)`,
        });

        // Progress: 20-60% for code generation
        const fileProgress = 20 + Math.round((generatedFiles.length / sortedFiles.length) * 40);
        await job.updateProgress(Math.min(fileProgress, 60));
      }

      if (generatedFiles.length === 0) {
        await this.setAgentTaskError(agentTaskId, 'No code was generated for any files.');
        throw new Error('No code generated');
      }

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'code_ready',
        message: `Generated code for ${generatedFiles.length} files`,
      });

      await job.updateProgress(65);

      // US-3.4: Check if code review is needed before pushing
      const needsCodeReview = await this.shouldWaitForReview(applicationId!, 'code');

      if (needsCodeReview) {
        // Persist generated files so push-code can pick them up later
        await this.prisma.agentTask.update({
          where: { id: agentTaskId },
          data: {
            status: 'code_pending_review',
            reviewRequestedAt: new Date(),
          },
        });

        await this.appendAgentTaskLog(agentTaskId, {
          step: 'awaiting_code_review',
          message: 'Code generated. Waiting for human review before pushing.',
          generatedFiles: generatedFiles.map((f) => ({
            filePath: f.filePath,
            operation: f.operation,
            contentLength: f.content.length,
          })),
        });

        // Store generated files in a dedicated JSON field within execution log
        // The push-code handler will re-generate or use the same job data
        const currentLog = (
          (
            await this.prisma.agentTask.findUnique({
              where: { id: agentTaskId },
              select: { executionLog: true },
            })
          )?.executionLog as ExecutionLogEntry[] | null
        ) || [];

        await this.prisma.agentTask.update({
          where: { id: agentTaskId },
          data: {
            executionLog: JSON.parse(JSON.stringify([
              ...currentLog,
              {
                step: 'generated_files_snapshot',
                timestamp: new Date().toISOString(),
                files: generatedFiles,
              },
            ])),
          },
        });

        this.logger.log(`Code for task ${agentTaskId} requires review (code_pending_review)`);

        await job.updateProgress(100);

        return {
          success: true,
          type: 'generate-code',
          ticketId,
          response: `Code generated for ${generatedFiles.length} files. Waiting for review.`,
          metadata: {
            agentTaskId,
            filesCount: generatedFiles.length,
            needsReview: true,
          },
        };
      }

      // Auto mode: proceed directly to push
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: { status: 'code_approved' },
      });

      // Read settings from ProjectGithubConfig
      const gitSettings = (githubConfig.settings as unknown as GitSettings) || {};

      // 7. Create branch via GitAutomationService
      const { branchName, baseSha } = await this.gitAutomationService.createBranch({
        octokit,
        owner,
        repo,
        defaultBranch,
        ticketId,
        ticketTitle: ticket.title || 'untitled',
        settings: gitSettings,
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'branch_created',
        message: `Created branch ${branchName} from ${defaultBranch} (${baseSha.substring(0, 7)})`,
      });

      await job.updateProgress(70);

      // 8. Atomic commit via GitAutomationService
      const changeType = actionPlan.files?.[0]?.changeType || 'bug_fix';
      const { commitSha } = await this.gitAutomationService.atomicCommit({
        octokit,
        owner,
        repo,
        branchName,
        baseSha,
        files: generatedFiles,
        ticketId,
        ticketTitle: ticket.title || 'AI-generated changes',
        agentTaskId,
        changeType,
        settings: gitSettings,
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'committed',
        message: `Committed ${generatedFiles.length} files (${commitSha.substring(0, 7)})`,
      });

      await job.updateProgress(85);

      // 9. Create or update PR via PullRequestService
      const prResult = await this.pullRequestService.createOrUpdatePR({
        octokit,
        owner,
        repo,
        branchName,
        defaultBranch,
        ticketId,
        ticket: {
          title: ticket.title || undefined,
          description: ticket.description || undefined,
          type: ticket.type || undefined,
          severity: ticket.severity || undefined,
          aiSummary: ticket.aiSummary || undefined,
        },
        actionPlan: {
          summary: actionPlan.summary || 'AI-generated changes.',
          rootCause: actionPlan.rootCause || 'See ticket for details.',
          testingStrategy: actionPlan.testingStrategy,
          files: actionPlan.files || [],
        },
        generatedFiles: generatedFiles.map((f) => ({
          filePath: f.filePath,
          operation: f.operation,
        })),
        agentTaskId,
        settings: {
          reviewers: gitSettings.reviewers,
          autoLabel: gitSettings.autoLabel !== false,
        },
      });

      await job.updateProgress(95);

      // 10. Update status to pr_created with PR metadata
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: {
          status: 'pr_created',
          prNumber: prResult.prNumber,
          prUrl: prResult.prUrl,
          branchName,
        },
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'completed',
        message: `Pull request ${prResult.created ? 'created' : 'updated'}: ${prResult.prUrl}`,
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
        branchName,
      });

      await job.updateProgress(100);

      this.logger.log(`PR #${prResult.prNumber} ${prResult.created ? 'created' : 'updated'} for agent task ${agentTaskId}: ${prResult.prUrl}`);

      return {
        success: true,
        type: 'generate-code',
        ticketId,
        response: `Pull request #${prResult.prNumber} ${prResult.created ? 'created' : 'updated'}: ${prResult.prUrl}`,
        metadata: {
          agentTaskId,
          filesCount: generatedFiles.length,
          complexity: actionPlan.estimatedComplexity,
          prUrl: prResult.prUrl,
          prNumber: prResult.prNumber,
          branchName,
        },
      };
    } catch (error) {
      // Set task to failed if not already set
      const currentTask = await this.prisma.agentTask.findUnique({
        where: { id: agentTaskId },
        select: { status: true },
      });
      if (currentTask && currentTask.status !== 'failed') {
        await this.setAgentTaskError(agentTaskId, getErrorMessage(error));
      }
      throw error;
    }
  }

  private buildCodeGenSystemPrompt(): string {
    return `You are a senior software developer writing code changes based on an action plan.

Your job is to generate the COMPLETE file content for the specified file. Follow these rules strictly:

1. Output ONLY the file content — no explanations, no markdown, no commentary
2. Wrap the entire output in a single code block with the language identifier:
   \`\`\`typescript
   // full file content here
   \`\`\`
3. For modifications: output the COMPLETE modified file, not just the changes
4. For new files: output the complete new file
5. Follow the project's existing coding conventions exactly
6. Maintain all existing imports, exports, and structure that should not change
7. Use TypeScript strict mode — no \`any\` types unless absolutely necessary
8. Follow NestJS patterns: decorators, dependency injection, DTOs with class-validator
9. All database queries must include tenantId filtering (multi-tenant architecture)
10. Use async/await, not raw promises
11. Include proper error handling with NestJS exceptions where appropriate
12. Do NOT add comments explaining your changes unless the logic is non-obvious`;
  }

  private buildCodeGenUserPrompt(
    file: { filePath: string; operation: string; description: string; changeType: string },
    currentContent: string,
    codeContext: Array<{ filePath: string; content: string; language: string; distance: number }>,
    actionPlan: { summary: string; rootCause: string; files: Array<{ filePath: string; operation: string; description: string; changeType: string }>; testingStrategy?: string },
    ciErrorLog?: string | null,
  ): string {
    const parts: string[] = [];

    // US-4.3: If this is a CI retry, include the error context first
    if (ciErrorLog) {
      parts.push('## Previous CI Error');
      parts.push('The previous code generation failed CI checks. Here is the error:');
      parts.push(ciErrorLog);
      parts.push('');
      parts.push('Please fix the issues described above in your code generation.');
      parts.push('');
    }

    parts.push('## Task');
    parts.push(`**Operation:** ${file.operation}`);
    parts.push(`**File:** ${file.filePath}`);
    parts.push(`**Change Type:** ${file.changeType}`);
    parts.push(`**Description:** ${file.description}`);
    parts.push('');
    parts.push('## Context');
    parts.push(`**Issue Summary:** ${actionPlan.summary}`);
    parts.push(`**Root Cause:** ${actionPlan.rootCause}`);

    if (currentContent) {
      parts.push('');
      parts.push('## Current File Content');
      parts.push(`\`\`\`typescript`);
      parts.push(this.truncateCodeSnippet(currentContent, 300));
      parts.push('```');
    }

    if (codeContext.length > 0) {
      parts.push('');
      parts.push('## Related Code (for reference)');
      for (const snippet of codeContext.slice(0, 5)) {
        parts.push(`### ${snippet.filePath}`);
        parts.push(`\`\`\`${snippet.language || 'typescript'}`);
        parts.push(this.truncateCodeSnippet(snippet.content, 50));
        parts.push('```');
      }
    }

    // List other files in the plan for context
    const otherFiles = actionPlan.files.filter((f: any) => f.filePath !== file.filePath);
    if (otherFiles.length > 0) {
      parts.push('');
      parts.push('## Other Files Being Changed (for context)');
      for (const f of otherFiles) {
        parts.push(`- \`${f.filePath}\` (${f.operation}): ${f.description}`);
      }
    }

    parts.push('');
    parts.push('## Instructions');
    if (file.operation === 'modify') {
      parts.push('Generate the COMPLETE modified file content. Include ALL original code that should remain unchanged, plus your modifications.');
    } else {
      parts.push('Generate the COMPLETE new file content.');
    }

    return parts.join('\n');
  }

  private extractCodeFromResponse(response: string): string {
    // Try to extract code from a code block
    const codeBlockMatch = response.match(/```(?:\w+)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1]!.trim();
    }

    // If no code block found, use the raw response (trimmed)
    return response.trim();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Push Code: Create Branch & PR after code review approval (US-3.4)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Push previously generated code to GitHub after code review approval.
   * Reads generated files from the execution log snapshot.
   */
  private async handlePushCode(job: Job<AgentJobData>): Promise<AgentResult> {
    const { ticketId, tenantId, applicationId, agentTaskId } = job.data;

    if (!agentTaskId || !applicationId) {
      throw new Error('agentTaskId and applicationId are required for push-code');
    }

    this.logger.log(`Pushing approved code for task ${agentTaskId}`);
    await job.updateProgress(5);

    // 1. Set status to pushing
    await this.prisma.agentTask.update({
      where: { id: agentTaskId },
      data: { status: 'pushing' },
    });

    try {
      // 2. Load task with full context
      const agentTask = await this.prisma.agentTask.findUnique({
        where: { id: agentTaskId },
        include: {
          ticket: {
            include: {
              application: {
                include: {
                  githubConfig: {
                    include: { installation: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!agentTask) {
        throw new Error(`Agent task ${agentTaskId} not found`);
      }

      const { ticket } = agentTask;
      const githubConfig = ticket.application?.githubConfig;

      if (!githubConfig) {
        throw new Error('No GitHub configuration found');
      }

      // 3. Retrieve generated files from execution log snapshot
      const executionLog = (agentTask.executionLog as ExecutionLogEntry[] | null) || [];
      const snapshot = executionLog
        .reverse()
        .find((entry) => entry.step === 'generated_files_snapshot');

      if (!snapshot?.files?.length) {
        throw new Error('No generated files snapshot found in execution log');
      }

      const generatedFiles = snapshot.files as Array<{
        filePath: string;
        content: string;
        operation: 'modify' | 'create' | 'delete';
      }>;

      await job.updateProgress(20);

      // 4. Get Octokit
      const { owner, repo, defaultBranch } = githubConfig;
      const connection = await this.prisma.githubConnection.findFirst({
        where: {
          tenantId,
          installationId: BigInt(githubConfig.installation.installationId),
        },
      });

      if (!connection?.accessToken) {
        throw new Error('No GitHub access token found');
      }

      const octokit = new Octokit({ auth: connection.accessToken });
      const actionPlan = agentTask.actionPlan as unknown as ActionPlan | null;
      const gitSettings = (githubConfig.settings as unknown as GitSettings) || {};

      // 5. Create branch
      const { branchName, baseSha } = await this.gitAutomationService.createBranch({
        octokit,
        owner,
        repo,
        defaultBranch,
        ticketId,
        ticketTitle: ticket.title || 'untitled',
        settings: gitSettings,
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'branch_created',
        message: `Created branch ${branchName} from ${defaultBranch}`,
      });

      await job.updateProgress(50);

      // 6. Commit
      const changeType = actionPlan?.files?.[0]?.changeType || 'bug_fix';
      const { commitSha } = await this.gitAutomationService.atomicCommit({
        octokit,
        owner,
        repo,
        branchName,
        baseSha,
        files: generatedFiles,
        ticketId,
        ticketTitle: ticket.title || 'AI-generated changes',
        agentTaskId,
        changeType,
        settings: gitSettings,
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'committed',
        message: `Committed ${generatedFiles.length} files (${commitSha.substring(0, 7)})`,
      });

      await job.updateProgress(75);

      // 7. Create PR
      const prResult = await this.pullRequestService.createOrUpdatePR({
        octokit,
        owner,
        repo,
        branchName,
        defaultBranch,
        ticketId,
        ticket: {
          title: ticket.title || undefined,
          description: ticket.description || undefined,
          type: ticket.type || undefined,
          severity: ticket.severity || undefined,
          aiSummary: ticket.aiSummary || undefined,
        },
        actionPlan: {
          summary: actionPlan?.summary || 'AI-generated changes.',
          rootCause: actionPlan?.rootCause || 'See ticket for details.',
          testingStrategy: actionPlan?.testingStrategy,
          files: actionPlan?.files || [],
        },
        generatedFiles: generatedFiles.map((f) => ({
          filePath: f.filePath,
          operation: f.operation,
        })),
        agentTaskId,
        settings: {
          reviewers: gitSettings.reviewers,
          autoLabel: gitSettings.autoLabel !== false,
        },
      });

      await job.updateProgress(95);

      // 8. Update status to pr_created
      await this.prisma.agentTask.update({
        where: { id: agentTaskId },
        data: {
          status: 'pr_created',
          prNumber: prResult.prNumber,
          prUrl: prResult.prUrl,
          branchName,
        },
      });

      await this.appendAgentTaskLog(agentTaskId, {
        step: 'completed',
        message: `Pull request ${prResult.created ? 'created' : 'updated'}: ${prResult.prUrl}`,
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
        branchName,
      });

      await job.updateProgress(100);

      this.logger.log(`PR #${prResult.prNumber} created for task ${agentTaskId}: ${prResult.prUrl}`);

      return {
        success: true,
        type: 'push-code',
        ticketId,
        response: `Pull request #${prResult.prNumber} created: ${prResult.prUrl}`,
        metadata: {
          agentTaskId,
          prUrl: prResult.prUrl,
          prNumber: prResult.prNumber,
          branchName,
        },
      };
    } catch (error) {
      const currentTask = await this.prisma.agentTask.findUnique({
        where: { id: agentTaskId },
        select: { status: true },
      });
      if (currentTask && currentTask.status !== 'failed') {
        await this.setAgentTaskError(agentTaskId, getErrorMessage(error));
      }
      throw error;
    }
  }

  /**
   * Search codebase embeddings using pgvector for relevant code snippets.
   */
  private async searchCodebaseEmbeddings(
    applicationId: string,
    ticket: { title: string | null; description: string | null; aiSummary: string | null },
  ): Promise<Array<{ filePath: string; content: string; language: string; distance: number }>> {
    // Build query from ticket content
    const queryParts = [ticket.title, ticket.description, ticket.aiSummary].filter(Boolean);
    if (queryParts.length === 0) return [];

    const queryText = queryParts.join(' ');

    // Generate embedding for the query using OpenAI
    try {
      const embeddingResult = await this.openaiService.generateEmbedding(queryText);
      const embeddingStr = `[${embeddingResult.embedding.join(',')}]`;

      const results: Array<{
        file_path: string;
        content: string;
        language: string;
        distance: number;
      }> = await this.prisma.$queryRawUnsafe(
        `SELECT file_path, content, language,
                embedding <=> $1::vector AS distance
         FROM codebase_embeddings
         WHERE application_id = $2::uuid
         ORDER BY distance
         LIMIT 10`,
        embeddingStr,
        applicationId,
      );

      return results.map((row) => ({
        filePath: row.file_path,
        content: row.content,
        language: row.language,
        distance: Number(row.distance),
      }));
    } catch (error) {
      this.logger.warn(`Codebase search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Get repo file tree via GitHub API using tenant's GitHub connection.
   */
  private async getRepoTreeForActionPlan(
    tenantId: string,
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<string[]> {
    try {
      // Get GitHub access token
      const connection = await this.prisma.githubConnection.findFirst({
        where: {
          tenantId,
          installationId: BigInt(installationId),
        },
      });

      if (!connection?.accessToken) {
        this.logger.warn('No GitHub access token found for repo tree');
        return [];
      }

      const octokit = new Octokit({ auth: connection.accessToken });

      const { data } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true',
      });

      return data.tree
        .filter((item) => item.type === 'blob' && item.path)
        .map((item) => item.path!)
        .slice(0, 200);
    } catch (error) {
      this.logger.warn(`Failed to get repo tree for ${owner}/${repo}: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Get decrypted Anthropic API key for a tenant.
   * The API encrypts with AES-256-GCM in iv:authTag:ciphertext format (base64).
   */
  private async getDecryptedAnthropicKey(tenantId: string): Promise<string | null> {
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!aiConfig?.encryptedApiKey) return null;

    const encryptedValue = aiConfig.encryptedApiKey;

    // Check if value looks encrypted (iv:authTag:ciphertext, base64)
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      // Value may be stored as plaintext (legacy or no middleware)
      return encryptedValue;
    }

    // Decrypt using ENCRYPTION_KEY env var (same key as API's EncryptionService)
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      this.logger.warn('ENCRYPTION_KEY not configured, cannot decrypt API key');
      return null;
    }

    try {
      const key = Buffer.from(keyHex, 'hex');
      const [ivB64, authTagB64, ciphertextB64] = parts;
      const iv = Buffer.from(ivB64!, 'base64');
      const authTag = Buffer.from(authTagB64!, 'base64');
      const ciphertext = Buffer.from(ciphertextB64!, 'base64');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error(`Failed to decrypt Anthropic API key: ${getErrorMessage(error)}`);
      return null;
    }
  }

  private buildActionPlanSystemPrompt(): string {
    return `You are a senior software developer analyzing a bug report for a codebase.
Your job is to:
1. Understand the reported issue from the ticket details
2. Analyze the relevant source code provided
3. Identify the root cause
4. Propose a concrete action plan with specific file changes

Project conventions:
- TypeScript with strict mode
- NestJS framework with dependency injection
- Prisma ORM for database access
- async/await over raw promises
- class-validator decorators for DTOs
- NestJS exceptions for error handling (BadRequestException, NotFoundException, etc.)
- Multi-tenant architecture: all data access must be scoped by tenantId

You MUST respond with valid JSON matching this exact structure:
{
  "summary": "Brief one-sentence summary of the issue and proposed fix",
  "rootCause": "Detailed explanation of what causes the bug",
  "files": [
    {
      "filePath": "path/to/file.ts",
      "operation": "modify",
      "description": "What needs to change in this file and why",
      "changeType": "bug_fix",
      "order": 1
    }
  ],
  "testingStrategy": "How to verify the fix works (unit tests, manual steps, etc.)",
  "risks": ["List of potential risks or side effects of the changes"],
  "estimatedComplexity": "low"
}

Rules:
- "operation" must be one of: "modify", "create", "delete"
- "changeType" must be one of: "bug_fix", "enhancement", "refactor", "test"
- "order" indicates the sequence in which files should be changed (1 = first)
- "estimatedComplexity" must be one of: "low", "medium", "high"
- File paths must match paths from the repository tree
- Be specific in descriptions: mention function names, line-level changes
- Only include files that actually need changes
- Do NOT wrap the JSON in markdown code blocks. Output raw JSON only.`;
  }

  private buildActionPlanUserPrompt(
    ticket: any,
    repoTree: string[],
    relevantCode: Array<{ filePath: string; content: string; language: string; distance: number }>,
  ): string {
    const parts: string[] = [];

    parts.push('## Bug Report\n');
    parts.push(`**Title:** ${ticket.title || 'Untitled'}`);
    parts.push(`**Type:** ${ticket.type || 'Unknown'}`);
    parts.push(`**Severity:** ${ticket.severity || 'Unknown'}`);

    if (ticket.description) {
      parts.push(`\n**Description:**\n${ticket.description}`);
    }
    if (ticket.aiSummary) {
      parts.push(`\n**AI Summary:**\n${ticket.aiSummary}`);
    }
    if (ticket.aiAnalysis) {
      const analysisStr = typeof ticket.aiAnalysis === 'string'
        ? ticket.aiAnalysis
        : JSON.stringify(ticket.aiAnalysis, null, 2);
      parts.push(`\n**AI Analysis:**\n${analysisStr}`);
    }
    if (ticket.reproductionSteps) {
      const stepsStr = typeof ticket.reproductionSteps === 'string'
        ? ticket.reproductionSteps
        : JSON.stringify(ticket.reproductionSteps, null, 2);
      parts.push(`\n**Reproduction Steps:**\n${stepsStr}`);
    }

    if (repoTree.length > 0) {
      parts.push('\n## Repository Structure\n');
      parts.push('```');
      parts.push(repoTree.join('\n'));
      parts.push('```');
    }

    if (relevantCode.length > 0) {
      parts.push('\n## Relevant Code Snippets\n');
      for (const snippet of relevantCode) {
        const truncated = this.truncateCodeSnippet(snippet.content, 100);
        parts.push(`### ${snippet.filePath} (similarity: ${(1 - snippet.distance).toFixed(3)})`);
        parts.push(`\`\`\`${snippet.language || 'typescript'}`);
        parts.push(truncated);
        parts.push('```\n');
      }
    }

    return parts.join('\n');
  }

  private truncateCodeSnippet(content: string, maxLines: number): string {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + `\n// ... truncated (${lines.length - maxLines} more lines)`;
  }

  private parseActionPlanResponse(text: string): {
    summary: string;
    rootCause: string;
    files: Array<{
      filePath: string;
      operation: 'modify' | 'create' | 'delete';
      description: string;
      changeType: 'bug_fix' | 'enhancement' | 'refactor' | 'test';
      order: number;
    }>;
    testingStrategy: string;
    risks: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
  } {
    let jsonStr = text.trim();

    // Remove markdown code block if present
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1]!.trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      this.logger.error(`Failed to parse Claude action plan JSON: ${text.substring(0, 500)}`);
      throw new Error('Claude returned invalid JSON for the action plan');
    }

    const validOperations = ['modify', 'create', 'delete'];
    const validChangeTypes = ['bug_fix', 'enhancement', 'refactor', 'test'];
    const validComplexities = ['low', 'medium', 'high'];

    return {
      summary: parsed.summary || '',
      rootCause: parsed.rootCause || '',
      files: Array.isArray(parsed.files)
        ? parsed.files.map((f: any, i: number) => ({
            filePath: f.filePath || '',
            operation: validOperations.includes(f.operation) ? f.operation : 'modify',
            description: f.description || '',
            changeType: validChangeTypes.includes(f.changeType) ? f.changeType : 'bug_fix',
            order: typeof f.order === 'number' ? f.order : i + 1,
          }))
        : [],
      testingStrategy: parsed.testingStrategy || '',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      estimatedComplexity: validComplexities.includes(parsed.estimatedComplexity)
        ? parsed.estimatedComplexity
        : 'medium',
    };
  }

  /**
   * US-3.4: Check whether the agent pipeline should wait for human review at a given phase.
   * Reads the agentMode from ProjectGithubConfig.settings.
   */
  private async shouldWaitForReview(
    applicationId: string,
    phase: 'plan' | 'code',
  ): Promise<boolean> {
    try {
      const config = await this.prisma.projectGithubConfig.findUnique({
        where: { applicationId },
      });

      if (!config) {
        return false; // No config = auto mode
      }

      const settings = (config.settings as Record<string, any>) ?? {};
      const mode = settings.agentMode;

      if (mode === 'review_all') {
        return true;
      }

      if (mode === 'review_plan' && phase === 'plan') {
        return true;
      }

      return false; // auto mode or review_plan with code phase
    } catch (error) {
      this.logger.warn(
        `Failed to check validation mode for app ${applicationId}: ${getErrorMessage(error)}`,
      );
      return false; // Fail open to auto mode
    }
  }

  /**
   * Append a log entry to an agent task's execution log.
   */
  private async appendAgentTaskLog(agentTaskId: string, entry: Record<string, any>): Promise<void> {
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
   * Build analysis prompt from ticket data
   */
  private buildAnalysisPrompt(ticket: any): string {
    const parts: string[] = [];

    parts.push(`## Ticket Information`);
    parts.push(`Title: ${ticket.title || 'No title'}`);
    parts.push(`Description: ${ticket.description || 'No description'}`);

    if (ticket.userContext) {
      parts.push(`\n## User Environment`);
      parts.push(JSON.stringify(ticket.userContext, null, 2));
    }

    if (ticket.media?.length) {
      parts.push(`\n## Media Analysis`);
      for (const media of ticket.media) {
        if (media.videoEvents?.length) {
          parts.push(`Video OCR text:`);
          const ocrTexts = media.videoEvents
            .filter((e: any) => e.ocrText)
            .map((e: any) => e.ocrText);
          parts.push(ocrTexts.join('\n').slice(0, 2000));
        }
      }
    }

    if (ticket.aiSummary) {
      parts.push(`\n## Previous AI Summary`);
      parts.push(ticket.aiSummary);
    }

    parts.push(`\n## Request`);
    parts.push(`Analyze this ticket and return a JSON object with:
{
  "classification": { "type": "bug|feature_request|question|documentation|performance|security|other", "confidence": 0.0-1.0 },
  "severity": { "level": "critical|high|medium|low", "confidence": 0.0-1.0 },
  "keywords": ["keyword1", "keyword2"],
  "summary": "A concise summary of the issue",
  "reproductionSteps": ["step1", "step2"] // if identifiable
}`);

    return parts.join('\n');
  }

  /**
   * Parse analysis response from GPT
   */
  private parseAnalysisResponse(content: string): TicketAnalysis {
    try {
      const parsed = JSON.parse(content);
      return {
        classification: parsed.classification || { type: 'other', confidence: 0.5 },
        severity: parsed.severity || { level: 'medium', confidence: 0.5 },
        keywords: parsed.keywords || [],
        summary: parsed.summary || '',
        reproductionSteps: parsed.reproductionSteps,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse analysis response: ${getErrorMessage(error)}`);
      return {
        classification: { type: 'other', confidence: 0.5 },
        severity: { level: 'medium', confidence: 0.5 },
        keywords: [],
        summary: content,
      };
    }
  }

  /**
   * Process function calls from GPT response
   */
  private async processFunctionCalls(
    toolCalls: any[],
    tenantId: string
  ): Promise<FunctionCallResult[]> {
    const results: FunctionCallResult[] = [];

    for (const call of toolCalls) {
      if (call.type !== 'function') continue;

      const { name, arguments: args } = call.function;
      const parsedArgs = JSON.parse(args);

      try {
        let result: unknown;

        switch (name) {
          case 'search_similar_tickets':
            result = await this.executeSearchSimilarTickets(
              parsedArgs.query,
              parsedArgs.limit,
              tenantId
            );
            break;

          case 'get_ticket_details':
            result = await this.executeGetTicketDetails(parsedArgs.ticketId);
            break;

          case 'update_ticket_status':
            result = await this.executeUpdateTicketStatus(parsedArgs.ticketId, parsedArgs.status);
            break;

          case 'escalate_to_human':
            result = await this.executeEscalateToHuman(
              parsedArgs.ticketId,
              parsedArgs.reason,
              parsedArgs.priority
            );
            break;

          case 'suggest_solution':
            result = await this.executeSuggestSolution(
              parsedArgs.ticketId,
              parsedArgs.similarTicketIds
            );
            break;

          default:
            result = { error: `Unknown function: ${name}` };
        }

        results.push({ name, arguments: parsedArgs, result });
      } catch (error) {
        results.push({
          name,
          arguments: parsedArgs,
          result: { error: getErrorMessage(error) },
        });
      }
    }

    return results;
  }

  /**
   * Function implementations
   */
  private async executeSearchSimilarTickets(
    query: string,
    limit: number,
    tenantId: string
  ): Promise<any> {
    const results = await this.meilisearch.search('tickets', query, {
      filter: `tenantId = "${tenantId}"`,
      limit: limit || 5,
    });
    return results.hits;
  }

  private async executeGetTicketDetails(ticketId: string): Promise<any> {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { media: true, application: true },
    });
  }

  private async executeUpdateTicketStatus(ticketId: string, status: string): Promise<any> {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  private async executeEscalateToHuman(
    ticketId: string,
    reason: string,
    priority?: string
  ): Promise<any> {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'escalated',
        priority: priority === 'critical' ? 10 : priority === 'high' ? 7 : 5,
        aiAnalysis: {
          escalatedAt: new Date().toISOString(),
          escalationReason: reason,
        },
      },
    });
  }

  private async executeSuggestSolution(
    ticketId: string,
    similarTicketIds?: string[]
  ): Promise<any> {
    return { ticketId, similarTicketIds, status: 'suggestion_pending' };
  }

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
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job<AgentJobData>) {
    this.logger.log(`Job ${job.id} started processing (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
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
      getErrorStack(error),
    );

    // If this was the last attempt, move to dead letter queue
    if (attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} exceeded max retries - moving to dead letter queue`);

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
        },
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

import { Injectable, Inject, Logger, NotFoundException, BadRequestException, forwardRef, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { AgentGateway } from './agent.gateway';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { NotificationService } from '../notifications/notification.service';

export enum AgentState {
  ANALYZING = 'analyzing',
  NEEDS_INFO = 'needs_info',
  PROPOSING = 'proposing',
  WAITING = 'waiting',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

interface TicketContext {
  id: string;
  tenantId: string;
  title?: string | null;
  description?: string | null;
  aiSummary?: string | null;
  type?: string | null;
  severity?: string | null;
}

interface AnalysisResult {
  confidence: number;
  needsEscalation?: boolean;
  needsMoreInfo?: boolean;
  hasSolution?: boolean;
  solution?: string;
  escalationReason?: string;
  questions?: string[];
  summary?: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService,
    @Inject(forwardRef(() => AgentGateway))
    private agentGateway: AgentGateway,
    @InjectQueue('agent-orchestration')
    private agentQueue: Queue,
    @Optional() @Inject(forwardRef(() => TicketsGateway))
    private ticketsGateway: TicketsGateway,
    @Optional()
    private notificationService: NotificationService,
  ) {}

  /**
   * Start an AI agent session for a ticket
   */
  async startSession(ticketId: string, tenantId: string) {
    // Verify ticket exists and belongs to tenant
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

    // Create agent session
    const session = await this.prisma.agentSession.create({
      data: {
        ticketId,
        status: AgentState.ANALYZING,
        agentState: {
          step: 'initial_analysis',
          context: {},
        },
      },
    });

    this.logger.log(`Started agent session for ticket ${ticketId}`);

    // Enqueue analysis job — runs in the worker process so the API stays
    // stateless and analysis survives a server restart.
    await this.agentQueue.add(
      'analyze-ticket',
      {
        type: 'analyze-ticket',
        ticketId,
        tenantId,
        sessionId: session.id,
      },
      {
        priority: 10,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      },
    );

    return session;
  }

  /**
   * Process ticket analysis (in-process fallback, kept for reference).
   * @deprecated Analysis is now handled by the worker via the agent-orchestration
   * BullMQ queue. This method is no longer called from startSession().
   */
  private async processTicketAnalysis(sessionId: string, ticket: TicketContext) {
    this.logger.log(`Analyzing ticket ${ticket.id}`);

    try {
      // Analyze ticket content
      const analysis = await this.analyzeTicket(ticket);

      // Determine next action based on analysis
      const nextState = this.determineNextState(analysis);

      // Update session
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: nextState,
          agentState: {
            step: 'analysis_complete',
            analysis,
            confidence: analysis.confidence,
          },
        },
      });

      // Notify connected clients about the state transition
      this.agentGateway.emitSessionUpdate(sessionId, {
        status: nextState,
        step: 'analysis_complete',
        confidence: analysis.confidence,
      });

      // Take action based on state
      await this.executeStateAction(sessionId, nextState, ticket, analysis);
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`);

      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: AgentState.ESCALATED,
          escalationReason: `Analysis failed: ${error.message}`,
        },
      });

      // Notify connected clients about the escalation
      this.agentGateway.emitSessionUpdate(sessionId, {
        status: AgentState.ESCALATED,
        reason: `Analysis failed: ${error.message}`,
      });
    }
  }

  /**
   * Analyze ticket using AI
   */
  private async analyzeTicket(ticket: TicketContext) {
    const prompt = `
Analyze this support ticket and provide:
1. Problem summary
2. Severity assessment (critical/high/medium/low)
3. Suggested solution or next steps
4. Confidence level (0-100)
5. Whether human escalation is needed

Ticket:
Title: ${ticket.title}
Description: ${ticket.description}
AI Summary: ${ticket.aiSummary || 'N/A'}
Type: ${ticket.type || 'Unknown'}
Severity: ${ticket.severity || 'Unknown'}

Respond in JSON format.
    `.trim();

    const response = await this.aiService.generateCompletion(prompt);

    try {
      return JSON.parse(response);
    } catch {
      // Fallback if parsing fails
      return {
        summary: response,
        severity: 'medium',
        confidence: 50,
        needsEscalation: false,
      };
    }
  }

  /**
   * Determine next agent state based on analysis
   */
  private determineNextState(analysis: AnalysisResult): AgentState {
    if (analysis.needsEscalation || analysis.confidence < 50) {
      return AgentState.ESCALATED;
    }

    if (analysis.needsMoreInfo) {
      return AgentState.NEEDS_INFO;
    }

    if (analysis.hasSolution) {
      return AgentState.PROPOSING;
    }

    return AgentState.WAITING;
  }

  /**
   * Execute action based on agent state
   */
  private async executeStateAction(
    sessionId: string,
    state: AgentState,
    ticket: TicketContext,
    analysis: AnalysisResult
  ) {
    switch (state) {
      case AgentState.PROPOSING:
        await this.proposeSolution(sessionId, ticket, analysis);
        break;

      case AgentState.NEEDS_INFO:
        await this.requestMoreInfo(sessionId, ticket, analysis);
        break;

      case AgentState.ESCALATED:
        await this.escalateToHuman(sessionId, ticket, analysis);
        break;

      default:
        this.logger.debug(`No action for state: ${state}`);
    }
  }

  /**
   * Propose solution to user
   */
  private async proposeSolution(sessionId: string, ticket: TicketContext, analysis: AnalysisResult) {
    const message = `Based on my analysis, here's a suggested solution:\n\n${analysis.solution}\n\nWould this help resolve your issue?`;

    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: message,
        channel: 'web',
        metadata: {
          analysis: analysis as unknown as Prisma.InputJsonValue,
        },
      },
    });

    this.logger.log(`Proposed solution for ticket ${ticket.id}`);
  }

  /**
   * Request more information from user
   */
  private async requestMoreInfo(sessionId: string, ticket: TicketContext, analysis: AnalysisResult) {
    const questions = analysis.questions || [
      'Could you provide more details about when this issue occurs?',
    ];

    const message = `To help you better, I need some additional information:\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}`;

    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: message,
        channel: 'web',
      },
    });

    this.logger.log(`Requested more info for ticket ${ticket.id}`);
  }

  /**
   * Escalate to human support.
   * Assigns the ticket, notifies the assignee via WebSocket and email,
   * and records an escalation message in the agent session.
   */
  private async escalateToHuman(sessionId: string, ticket: TicketContext, analysis: AnalysisResult) {
    const escalationReason = analysis.escalationReason || 'Requires human review';

    // Find available support agent
    const supportAgent = await this.prisma.user.findFirst({
      where: {
        tenantId: ticket.tenantId,
        role: 'admin',
      },
      select: { id: true, email: true, name: true },
    });

    if (supportAgent) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          escalatedTo: supportAgent.id,
          escalationReason,
        },
      });

      const updatedTicket = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTo: supportAgent.id,
          assignedAt: new Date(),
        },
        include: { application: true },
      });

      // Build conversation summary from recent messages
      const messages = await this.prisma.agentMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      const summary = messages
        .reverse()
        .map((m: { role: string; content: string }) => `[${m.role}] ${m.content}`)
        .join('\n');

      // WebSocket: notify all connected dashboard users in the tenant
      if (this.ticketsGateway) {
        this.ticketsGateway.emitTicketAssigned(ticket.tenantId, updatedTicket);
        this.ticketsGateway.emitEscalation(ticket.tenantId, {
          ticketId: ticket.id,
          sessionId,
          reason: escalationReason,
          assignedTo: supportAgent.id,
          summary,
        });
      }

      // WebSocket: update agent session state for users in the chat room
      this.agentGateway.emitSessionUpdate(sessionId, {
        status: AgentState.ESCALATED,
        reason: escalationReason,
        assignedTo: supportAgent.id,
      });

      // Email notification via the notification service
      if (this.notificationService && updatedTicket.application) {
        this.notificationService
          .dispatchNotification({
            ticketId: ticket.id,
            tenantId: ticket.tenantId,
            applicationId: updatedTicket.application.id,
            eventType: 'agent_escalated',
            data: {
              reason: escalationReason,
              assignedToEmail: supportAgent.email,
              assignedToName: supportAgent.name,
              ticketTitle: ticket.title,
              conversationSummary: summary,
            },
          })
          .catch((err: unknown) => {
            this.logger.warn(
              `Failed to dispatch escalation notification: ${err instanceof Error ? err.message : err}`,
            );
          });
      }
    }

    // Record an escalation message in the session
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: `This conversation has been escalated to a human support agent. Reason: ${escalationReason}`,
        channel: 'web',
        metadata: { escalation: true, reason: escalationReason },
      },
    });

    this.logger.log(`Escalated ticket ${ticket.id} to human support`);
  }

  /**
   * Get agent session with messages
   */
  async getSession(sessionId: string, tenantId: string) {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        ticket: { tenantId },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        ticket: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Agent session not found');
    }

    return session;
  }

  /**
   * Send message to agent.
   * Saves the user message, transitions the state machine, generates the AI
   * response, and returns the agent message.
   *
   * Emits WebSocket events directly (typing indicators and new messages) so
   * the gateway handler only needs to validate input and call this method.
   */
  /**
   * Resolve an agent session, marking it as RESOLVED.
   * A resolved session cannot receive further messages.
   */
  async resolveSession(sessionId: string, tenantId: string) {
    const session = await this.getSession(sessionId, tenantId);

    if (session.status === AgentState.RESOLVED) {
      throw new BadRequestException('Session is already resolved');
    }

    const updated = await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: AgentState.RESOLVED },
    });

    this.agentGateway.emitSessionUpdate(sessionId, { status: AgentState.RESOLVED });

    this.logger.log(`Resolved agent session ${sessionId}`);

    return updated;
  }

  async sendMessage(sessionId: string, tenantId: string, content: string, _userId?: string) {
    const session = await this.getSession(sessionId, tenantId);

    // Reject messages sent to closed (resolved or escalated) sessions
    if (session.status === AgentState.RESOLVED || session.status === AgentState.ESCALATED) {
      throw new BadRequestException('Cannot send messages to a closed session');
    }

    // Create user message
    const userMessage = await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
        channel: 'web',
      },
    });

    // Broadcast the user message to all clients in the room
    this.agentGateway.emitNewMessage(sessionId, userMessage);

    // Transition state machine: NEEDS_INFO or WAITING -> ANALYZING
    if (session.status === AgentState.NEEDS_INFO || session.status === AgentState.WAITING) {
      // Cancel any pending timeout job for this session
      await this.cancelTimeoutJob(sessionId);

      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: AgentState.ANALYZING },
      });

      this.agentGateway.emitSessionUpdate(sessionId, { status: AgentState.ANALYZING });
    }

    // Signal that the agent is thinking
    this.agentGateway.emitAgentTyping(sessionId, true);

    // Generate agent response
    const response = await this.generateAgentResponse(session, content);

    // Parse response to determine next state
    const nextState = this.determineNextStateFromResponse(response);

    // Create agent message
    const agentMessage = await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: response,
        channel: 'web',
      },
    });

    // Update session state
    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: nextState },
    });

    // Agent finished thinking
    this.agentGateway.emitAgentTyping(sessionId, false);

    // Broadcast the agent response
    this.agentGateway.emitNewMessage(sessionId, agentMessage);

    // Emit session state update
    this.agentGateway.emitSessionUpdate(sessionId, { status: nextState });

    // If transitioning to NEEDS_INFO, schedule timeout
    if (nextState === AgentState.NEEDS_INFO) {
      await this.scheduleTimeoutJob(sessionId, session.ticket.id, tenantId);
    }

    return agentMessage;
  }

  /**
   * Process user message asynchronously (called by worker).
   * Generates an AI response, updates session state, and emits events.
   */
  async processUserMessageAsync(
    sessionId: string,
    tenantId: string,
    content: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId, tenantId);

    // Signal that the agent is thinking
    this.agentGateway.emitAgentTyping(sessionId, true);

    try {
      // Generate agent response
      const response = await this.generateAgentResponse(session, content);

      // Parse response to determine next state
      const nextState = this.determineNextStateFromResponse(response);

      // Create agent message
      const agentMessage = await this.prisma.agentMessage.create({
        data: {
          sessionId,
          role: 'agent',
          content: response,
          channel: 'web',
        },
      });

      // Update session state
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: nextState },
      });

      // Agent finished thinking
      this.agentGateway.emitAgentTyping(sessionId, false);

      // Broadcast the agent response
      this.agentGateway.emitNewMessage(sessionId, agentMessage);

      // Emit session state update
      this.agentGateway.emitSessionUpdate(sessionId, { status: nextState });

      // If transitioning to NEEDS_INFO, schedule timeout
      if (nextState === AgentState.NEEDS_INFO) {
        await this.scheduleTimeoutJob(sessionId, session.ticket.id, tenantId);
      }
    } catch (error) {
      this.agentGateway.emitAgentTyping(sessionId, false);
      throw error;
    }
  }

  /**
   * Determine next session state based on agent response content.
   */
  private determineNextStateFromResponse(response: string): AgentState {
    const lower = response.toLowerCase();

    // If the response asks for more information, go to NEEDS_INFO
    if (
      lower.includes('could you') ||
      lower.includes('can you provide') ||
      lower.includes('please share') ||
      lower.includes('need more') ||
      lower.includes('need additional') ||
      lower.includes('more details') ||
      lower.includes('more information')
    ) {
      return AgentState.NEEDS_INFO;
    }

    // If the response proposes a solution
    if (
      lower.includes('here is a solution') ||
      lower.includes('here\'s a solution') ||
      lower.includes('suggested solution') ||
      lower.includes('to resolve') ||
      lower.includes('you can fix') ||
      lower.includes('steps to resolve')
    ) {
      return AgentState.PROPOSING;
    }

    // Default: wait for user reply
    return AgentState.WAITING;
  }

  /**
   * Schedule a delayed job to auto-escalate if the session stays in NEEDS_INFO.
   * Delay: 24 hours.
   */
  private async scheduleTimeoutJob(
    sessionId: string,
    ticketId: string,
    tenantId: string,
  ): Promise<void> {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    await this.agentQueue.add(
      'auto-escalate-timeout',
      {
        type: 'auto-escalate-timeout',
        ticketId,
        tenantId,
        sessionId,
      },
      {
        delay: TWENTY_FOUR_HOURS_MS,
        jobId: `timeout:${sessionId}`,
        attempts: 1,
      },
    );

    this.logger.log(`Scheduled auto-escalate timeout for session ${sessionId} in 24h`);
  }

  /**
   * Cancel a pending timeout job for a session (called when user replies).
   */
  private async cancelTimeoutJob(sessionId: string): Promise<void> {
    try {
      const job = await this.agentQueue.getJob(`timeout:${sessionId}`);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled timeout job for session ${sessionId}`);
      }
    } catch {
      // Job may not exist — ignore
    }
  }

  /**
   * Generate agent response using AI
   */
  private async generateAgentResponse(session: Record<string, unknown>, userMessage: string) {
    const messages = session.messages as Array<{ role: string; content: string }>;
    const ticket = session.ticket as { title: string; description: string };
    const context = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `
You are a helpful support agent. Based on the conversation history and ticket details, respond to the user's message.

Ticket: ${ticket.title}
Description: ${ticket.description}

Conversation:
${context}

User: ${userMessage}

Agent:
    `.trim();

    return this.aiService.generateCompletion(prompt);
  }
}

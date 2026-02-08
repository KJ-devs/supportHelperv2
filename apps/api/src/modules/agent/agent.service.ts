import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';

export enum AgentState {
  ANALYZING = 'analyzing',
  NEEDS_INFO = 'needs_info',
  PROPOSING = 'proposing',
  WAITING = 'waiting',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AIService
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

    // Trigger initial analysis asynchronously
    this.processTicketAnalysis(session.id, ticket).catch(error => {
      this.logger.error(`Error in agent analysis: ${error.message}`, error);
    });

    return session;
  }

  /**
   * Process ticket analysis
   */
  private async processTicketAnalysis(sessionId: string, ticket: any) {
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
    }
  }

  /**
   * Analyze ticket using AI
   */
  private async analyzeTicket(ticket: any) {
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
  private determineNextState(analysis: any): AgentState {
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
    ticket: any,
    analysis: any
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
  private async proposeSolution(sessionId: string, ticket: any, analysis: any) {
    const message = `Based on my analysis, here's a suggested solution:\n\n${analysis.solution}\n\nWould this help resolve your issue?`;

    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: message,
        channel: 'web',
        metadata: {
          analysis,
        },
      },
    });

    this.logger.log(`Proposed solution for ticket ${ticket.id}`);
  }

  /**
   * Request more information from user
   */
  private async requestMoreInfo(sessionId: string, ticket: any, analysis: any) {
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
   * Escalate to human support
   */
  private async escalateToHuman(sessionId: string, ticket: any, analysis: any) {
    // Find available support agent (simplified)
    const supportAgent = await this.prisma.user.findFirst({
      where: {
        tenantId: ticket.tenantId,
        role: 'admin',
      },
    });

    if (supportAgent) {
      await this.prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          escalatedTo: supportAgent.id,
          escalationReason: analysis.escalationReason || 'Requires human review',
        },
      });

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTo: supportAgent.id,
          assignedAt: new Date(),
        },
      });
    }

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
   * Send message to agent
   */
  async sendMessage(sessionId: string, tenantId: string, content: string, userId?: string) {
    const session = await this.getSession(sessionId, tenantId);

    // Create user message
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
        channel: 'web',
      },
    });

    // Generate agent response
    const response = await this.generateAgentResponse(session, content);

    // Create agent message
    const agentMessage = await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'agent',
        content: response,
        channel: 'web',
      },
    });

    return agentMessage;
  }

  /**
   * Generate agent response using AI
   */
  private async generateAgentResponse(session: any, userMessage: string) {
    const context = session.messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `
You are a helpful support agent. Based on the conversation history and ticket details, respond to the user's message.

Ticket: ${session.ticket.title}
Description: ${session.ticket.description}

Conversation:
${context}

User: ${userMessage}

Agent:
    `.trim();

    return this.aiService.generateCompletion(prompt);
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import { PrismaService } from './prisma.service';
import { OpenAIService } from './openai.service';
import { GithubService, GithubConnection } from './github.service';
import { EmailService } from './email.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

// ═══════════════════════════════════════════════════════════════════════
// STATE MACHINE (Zod Enum)
// ═══════════════════════════════════════════════════════════════════════

export const AgentStateEnum = z.enum([
  'ANALYZING', // Analyze ticket + search solutions
  'NEEDS_INFO', // Ask user questions
  'PROPOSING', // Propose solution with confidence
  'WAITING', // Wait for user response
  'RESOLVED', // Mark as resolved
  'ESCALATED', // Assign to human
]);

export type AgentState = z.infer<typeof AgentStateEnum>;

// ═══════════════════════════════════════════════════════════════════════
// INTERFACES & TYPES
// ═══════════════════════════════════════════════════════════════════════

export const ChannelEnum = z.enum(['email', 'github', 'chat']);
export type Channel = z.infer<typeof ChannelEnum>;

export const SeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof SeverityEnum>;

export interface AgentSessionData {
  id: string;
  ticketId: string;
  tenantId: string;
  state: AgentState;
  attempts: number;
  confidence: number;
  context: AgentContextData;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentContextData {
  ticketAnalysis?: TicketAnalysisResult;
  similarTickets?: SimilarTicketResult[];
  githubIssues?: GithubIssueResult[];
  questions?: string[];
  proposedSolution?: string;
  conversation: ConversationMessage[];
  escalationReason?: string;
}

export interface ConversationMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  channel: Channel;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TicketAnalysisResult {
  summary: string;
  type: string;
  severity: Severity;
  keywords: string[];
  rootCause?: string;
  reproductionSteps?: string[];
  confidence: number;
}

export interface SimilarTicketResult {
  id: string;
  title: string;
  description: string;
  similarity: number;
  status: string;
  resolution?: string;
}

export interface GithubIssueResult {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  labels: string[];
}

export interface ProposedSolution {
  solution: string;
  confidence: number;
  sources: string[];
  steps?: string[];
}

export interface EscalationResult {
  reason: string;
  assignee?: string;
  priority: string;
  channel: Channel;
}

// ═══════════════════════════════════════════════════════════════════════
// SECURITY KEYWORDS FOR ESCALATION
// ═══════════════════════════════════════════════════════════════════════

const SECURITY_KEYWORDS = [
  'vulnerability',
  'exploit',
  'injection',
  'xss',
  'csrf',
  'sql injection',
  'authentication bypass',
  'password leak',
  'data breach',
  'unauthorized access',
  'privilege escalation',
  'security flaw',
  'cve',
  'zero-day',
  'malware',
  'ransomware',
  'phishing',
  'token leak',
  'api key exposed',
  'credentials',
];

const HUMAN_REQUEST_KEYWORDS = [
  'speak to human',
  'talk to human',
  'real person',
  'human agent',
  'human support',
  'speak to agent',
  'talk to agent',
  'escalate',
  'manager',
  'supervisor',
];

// ═══════════════════════════════════════════════════════════════════════
// GPT-4o FUNCTION CALLING TOOLS
// ═══════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════
// AGENT SERVICE
// ═══════════════════════════════════════════════════════════════════════

/**
 * AI Support Agent Service
 *
 * Implements Phase 4: Agent Processing from architecture:
 * - State Machine (Zod enum): ANALYZING → NEEDS_INFO → PROPOSING → WAITING → RESOLVED → ESCALATED
 * - GPT-4o Function Calling for tool use
 * - Escalation rules based on confidence, severity, keywords
 * - Agent loop with conversation tracking
 * - Multi-channel support (email, GitHub, chat)
 */
@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private openaiClient!: OpenAI;

  // Configuration
  private readonly MAX_ATTEMPTS = 3;
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly githubService: GithubService,
    private readonly emailService: EmailService
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openaiClient = new OpenAI({ apiKey });
    this.logger.log('AgentService initialized with GPT-4o function calling');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN AGENT LOOP
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Start a new agent session for a ticket
   */
  async startSession(ticketId: string, tenantId: string): Promise<AgentSessionData> {
    this.logger.log(`Starting agent session for ticket ${ticketId}`);

    // Verify ticket exists
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: true,
        application: true,
        reporter: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    // Create agent session in database
    const session = await this.prisma.agentSession.create({
      data: {
        ticketId,
        status: 'ANALYZING',
        agentState: JSON.parse(
          JSON.stringify({
            state: 'ANALYZING' as AgentState,
            attempts: 0,
            confidence: 0,
            context: {
              conversation: [],
            },
          })
        ),
      },
    });

    // Return session data
    const sessionData: AgentSessionData = {
      id: session.id,
      ticketId,
      tenantId,
      state: 'ANALYZING',
      attempts: 0,
      confidence: 0,
      context: {
        conversation: [],
      },
      createdAt: session.createdAt,
      updatedAt: session.lastActionAt,
    };

    // Start the agent loop asynchronously
    this.runAgentLoop(sessionData, ticket).catch(error => {
      this.logger.error(`Agent loop error: ${getErrorMessage(error)}`, getErrorStack(error));
    });

    return sessionData;
  }

  /**
   * Main agent processing loop
   * 1. Analyze new ticket
   * 2. Search knowledge base (pgvector)
   * 3. If confident → propose
   * 4. If not → ask questions or escalate
   * 5. Track conversation in agent_messages
   * 6. Update agent_sessions state
   */
  async runAgentLoop(session: AgentSessionData, ticket: any): Promise<void> {
    this.logger.log(`Running agent loop for session ${session.id}, state: ${session.state}`);

    let currentState = session.state;
    let attempts = session.attempts;
    let context = session.context;

    while (this.isActiveState(currentState) && attempts < this.MAX_ATTEMPTS) {
      try {
        // Process current state
        const result = await this.processState(currentState, session, ticket, context);

        // Update context with result
        context = { ...context, ...result.context };

        // Transition to next state
        const nextState = result.nextState;

        // Update session in database
        await this.updateSession(session.id, {
          state: nextState,
          attempts: result.incrementAttempt ? attempts + 1 : attempts,
          confidence: result.confidence ?? session.confidence,
          context,
        });

        // Track state transition
        this.logger.log(`State transition: ${currentState} → ${nextState}`);

        // Update local state
        currentState = nextState;
        if (result.incrementAttempt) {
          attempts++;
        }

        // Exit if terminal state
        if (this.isTerminalState(nextState)) {
          this.logger.log(`Agent reached terminal state: ${nextState}`);
          break;
        }

        // Wait a bit before next iteration (rate limiting)
        await this.sleep(500);
      } catch (error) {
        this.logger.error(`Error in agent loop: ${getErrorMessage(error)}`);
        attempts++;

        // Escalate on repeated errors
        if (attempts >= this.MAX_ATTEMPTS) {
          await this.escalateTicket(session, ticket, {
            reason: `Agent failed after ${attempts} attempts: ${getErrorMessage(error)}`,
            priority: 'high',
          });
          currentState = 'ESCALATED';
        }
      }
    }

    // Final state check
    if (attempts >= this.MAX_ATTEMPTS && !this.isTerminalState(currentState)) {
      await this.escalateTicket(session, ticket, {
        reason: `No solution after ${this.MAX_ATTEMPTS} attempts`,
        priority: 'medium',
      });
    }
  }

  /**
   * Process a state in the state machine
   */
  private async processState(
    state: AgentState,
    session: AgentSessionData,
    ticket: any,
    context: AgentContextData
  ): Promise<{
    nextState: AgentState;
    context: Partial<AgentContextData>;
    confidence?: number;
    incrementAttempt?: boolean;
  }> {
    switch (state) {
      case 'ANALYZING':
        return this.handleAnalyzingState(session, ticket, context);

      case 'NEEDS_INFO':
        return this.handleNeedsInfoState(session, ticket, context);

      case 'PROPOSING':
        return this.handleProposingState(session, ticket, context);

      case 'WAITING':
        return this.handleWaitingState(session, ticket, context);

      case 'RESOLVED':
      case 'ESCALATED':
        // Terminal states - no processing needed
        return { nextState: state, context: {} };

      default:
        throw new Error(`Unknown state: ${state}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ANALYZING state: Analyze ticket + search solutions
   */
  private async handleAnalyzingState(
    session: AgentSessionData,
    ticket: any,
    context: AgentContextData
  ): Promise<{
    nextState: AgentState;
    context: Partial<AgentContextData>;
    confidence?: number;
    incrementAttempt?: boolean;
  }> {
    this.logger.log(`Analyzing ticket ${ticket.id}`);

    // Step 1: Analyze the ticket
    const analysis = await this.analyzeTicket(ticket);

    // Step 2: Check for immediate escalation triggers
    const escalationCheck = this.checkEscalationRules(ticket, analysis, context);
    if (escalationCheck.shouldEscalate) {
      return {
        nextState: 'ESCALATED',
        context: {
          ticketAnalysis: analysis,
          escalationReason: escalationCheck.reason,
        },
        confidence: analysis.confidence,
      };
    }

    // Step 3: Search for similar tickets in knowledge base
    const searchQuery = `${ticket.title} ${ticket.description || ''} ${analysis.keywords.join(' ')}`;
    const similarTickets = await this.searchSimilarTickets(searchQuery, session.tenantId, 5);

    // Step 4: Search GitHub issues if app has repo configured
    let githubIssues: GithubIssueResult[] = [];
    if (ticket.application?.githubRepo) {
      githubIssues = await this.searchGithubIssues(ticket.application.githubRepo, searchQuery);
    }

    // Step 5: Determine next state based on confidence
    const confidence = this.calculateConfidence(analysis, similarTickets, githubIssues);

    if (confidence >= this.CONFIDENCE_THRESHOLD) {
      return {
        nextState: 'PROPOSING',
        context: {
          ticketAnalysis: analysis,
          similarTickets,
          githubIssues,
        },
        confidence,
      };
    } else {
      // Need more information
      const questions = await this.generateClarifyingQuestions(ticket, analysis);
      return {
        nextState: 'NEEDS_INFO',
        context: {
          ticketAnalysis: analysis,
          similarTickets,
          githubIssues,
          questions,
        },
        confidence,
        incrementAttempt: true,
      };
    }
  }

  /**
   * NEEDS_INFO state: Ask user questions
   */
  private async handleNeedsInfoState(
    session: AgentSessionData,
    ticket: any,
    context: AgentContextData
  ): Promise<{
    nextState: AgentState;
    context: Partial<AgentContextData>;
    confidence?: number;
    incrementAttempt?: boolean;
  }> {
    this.logger.log(`Requesting more info for ticket ${ticket.id}`);

    const questions = context.questions || [
      'Could you provide more details about when this issue occurs?',
      'What steps did you take before encountering this problem?',
    ];

    // Send questions through appropriate channel
    const channel = this.determineChannel(ticket);
    await this.askQuestion(session, ticket, questions.join('\n\n'), channel);

    // Store message in conversation
    const message: ConversationMessage = {
      role: 'agent',
      content: `I need some additional information:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
      channel,
      timestamp: new Date(),
    };

    return {
      nextState: 'WAITING',
      context: {
        conversation: [...(context.conversation || []), message],
      },
    };
  }

  /**
   * PROPOSING state: Propose solution with confidence
   */
  private async handleProposingState(
    session: AgentSessionData,
    ticket: any,
    context: AgentContextData
  ): Promise<{
    nextState: AgentState;
    context: Partial<AgentContextData>;
    confidence?: number;
    incrementAttempt?: boolean;
  }> {
    this.logger.log(`Proposing solution for ticket ${ticket.id}`);

    // Generate solution based on analysis and similar tickets
    const solution = await this.generateSolution(ticket, context);

    // Check confidence threshold
    if (solution.confidence < this.CONFIDENCE_THRESHOLD) {
      return {
        nextState: 'ESCALATED',
        context: {
          proposedSolution: solution.solution,
          escalationReason: `Solution confidence too low: ${solution.confidence}`,
        },
        confidence: solution.confidence,
      };
    }

    // Send solution through appropriate channel
    const channel = this.determineChannel(ticket);
    await this.proposeSolution(session, ticket, solution, channel);

    // Store message in conversation
    const message: ConversationMessage = {
      role: 'agent',
      content: solution.solution,
      channel,
      timestamp: new Date(),
      metadata: { confidence: solution.confidence, steps: solution.steps },
    };

    return {
      nextState: 'WAITING',
      context: {
        proposedSolution: solution.solution,
        conversation: [...(context.conversation || []), message],
      },
      confidence: solution.confidence,
    };
  }

  /**
   * WAITING state: Wait for user response
   */
  private async handleWaitingState(
    session: AgentSessionData,
    ticket: any,
    context: AgentContextData
  ): Promise<{
    nextState: AgentState;
    context: Partial<AgentContextData>;
    confidence?: number;
    incrementAttempt?: boolean;
  }> {
    // Check for new user messages
    const latestMessage = await this.getLatestUserMessage(session.id);

    if (!latestMessage) {
      // No response yet - stay in waiting state
      return {
        nextState: 'WAITING',
        context: {},
      };
    }

    // Check if user requests human
    if (this.userRequestsHuman(latestMessage.content)) {
      return {
        nextState: 'ESCALATED',
        context: {
          escalationReason: 'User requested human assistance',
        },
      };
    }

    // Check if user confirms resolution
    if (this.userConfirmsResolution(latestMessage.content)) {
      await this.resolveTicket(session, ticket);
      return {
        nextState: 'RESOLVED',
        context: {},
      };
    }

    // Process user response with GPT-4o
    const response = await this.processUserResponse(
      session,
      ticket,
      latestMessage.content,
      context
    );

    if (response.needsMoreInfo) {
      return {
        nextState: 'NEEDS_INFO',
        context: {
          questions: response.questions,
          conversation: [
            ...(context.conversation || []),
            {
              role: 'user' as const,
              content: latestMessage.content,
              channel: latestMessage.channel as Channel,
              timestamp: new Date(),
            },
          ],
        },
        incrementAttempt: true,
      };
    }

    if (response.hasSolution) {
      return {
        nextState: 'PROPOSING',
        context: {
          conversation: [
            ...(context.conversation || []),
            {
              role: 'user' as const,
              content: latestMessage.content,
              channel: latestMessage.channel as Channel,
              timestamp: new Date(),
            },
          ],
        },
        confidence: response.confidence,
      };
    }

    // Default: continue waiting
    return {
      nextState: 'WAITING',
      context: {
        conversation: [
          ...(context.conversation || []),
          {
            role: 'user' as const,
            content: latestMessage.content,
            channel: latestMessage.channel as Channel,
            timestamp: new Date(),
          },
        ],
      },
      incrementAttempt: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GPT-4o FUNCTION CALLING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Run GPT-4o with function calling tools
   */


  // ═══════════════════════════════════════════════════════════════════════
  // TOOL IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════








  // ═══════════════════════════════════════════════════════════════════════
  // CORE ANALYSIS METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze ticket using GPT-4o
   */
  private async analyzeTicket(ticket: any): Promise<TicketAnalysisResult> {
    const prompt = `Analyze this support ticket and provide a structured analysis:

Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
Type: ${ticket.type || 'Unknown'}
Severity: ${ticket.severity || 'Unknown'}
AI Summary: ${ticket.aiSummary || 'Not available'}
User Context: ${JSON.stringify(ticket.userContext || {})}

Respond with JSON:
{
  "summary": "Brief summary of the issue",
  "type": "bug|feature|question|documentation|performance|security|other",
  "severity": "critical|high|medium|low",
  "keywords": ["keyword1", "keyword2"],
  "rootCause": "Probable root cause if identifiable",
  "reproductionSteps": ["step1", "step2"],
  "confidence": 0.0-1.0
}`;

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert technical support analyst.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    try {
      const content = response.choices[0]?.message?.content;
      return JSON.parse(content || '{}');
    } catch {
      return {
        summary: ticket.title || '',
        type: 'other',
        severity: 'medium',
        keywords: [],
        confidence: 0.5,
      };
    }
  }

  /**
   * Search similar tickets using pgvector
   */
  private async searchSimilarTickets(
    query: string,
    tenantId: string,
    limit: number = 5
  ): Promise<SimilarTicketResult[]> {
    try {
      const embeddingResult = await this.openaiService.generateEmbedding(query);
      const results = await this.openaiService.searchSimilarTickets(
        embeddingResult.embedding,
        limit,
        tenantId
      );
      return results;
    } catch (error) {
      this.logger.warn(`Similar ticket search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Search GitHub issues
   */
  private async searchGithubIssues(repo: string, query: string): Promise<GithubIssueResult[]> {
    try {
      // Initialize GitHub with tenant's connection
      const connection = await this.prisma.githubConnection.findFirst({
        where: { repos: { path: ['$'], array_contains: repo } },
      });

      if (connection) {
        await this.githubService.initialize(connection as GithubConnection);
        return this.searchGithubIssues(repo, query);
      }
      return [];
    } catch (error) {
      this.logger.warn(`GitHub issue search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Generate clarifying questions using GPT-4o
   */
  private async generateClarifyingQuestions(
    ticket: any,
    analysis: TicketAnalysisResult
  ): Promise<string[]> {
    const prompt = `Based on this ticket analysis, generate 2-3 clarifying questions to better understand the issue:

Ticket: ${ticket.title}
Description: ${ticket.description}
Analysis: ${JSON.stringify(analysis)}

Generate specific, helpful questions. Respond with JSON array: ["question1", "question2", "question3"]`;

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful support agent gathering information.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    try {
      const content = response.choices[0]?.message?.content;
      const parsed = JSON.parse(content || '{"questions":[]}');
      return Array.isArray(parsed) ? parsed : parsed.questions || [];
    } catch {
      return ['Could you provide more details about when this issue occurs?'];
    }
  }

  /**
   * Generate solution based on analysis and similar tickets
   */
  private async generateSolution(
    ticket: any,
    context: AgentContextData
  ): Promise<ProposedSolution> {
    const similarContext = (context.similarTickets || [])
      .map((t, i) => `${i + 1}. ${t.title}: ${t.resolution || t.description}`)
      .join('\n');

    const githubContext = (context.githubIssues || [])
      .map((i, idx) => `${idx + 1}. #${i.number}: ${i.title}`)
      .join('\n');

    const prompt = `Generate a solution for this support ticket:

Ticket: ${ticket.title}
Description: ${ticket.description}
Analysis: ${JSON.stringify(context.ticketAnalysis)}

Similar resolved tickets:
${similarContext || 'None found'}

Related GitHub issues:
${githubContext || 'None found'}

Provide a helpful, actionable solution. Respond with JSON:
{
  "solution": "Detailed solution explanation",
  "confidence": 0.0-1.0,
  "steps": ["step1", "step2"],
  "sources": ["similar ticket ID or GitHub issue"]
}`;

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert technical support agent providing solutions.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    try {
      const content = response.choices[0]?.message?.content;
      return JSON.parse(content || '{}');
    } catch {
      return {
        solution:
          'I apologize, but I could not generate a solution. Please wait for human assistance.',
        confidence: 0.3,
        sources: [],
      };
    }
  }

  /**
   * Process user response
   */
  private async processUserResponse(
    _session: AgentSessionData,
    ticket: any,
    userMessage: string,
    context: AgentContextData
  ): Promise<{
    needsMoreInfo: boolean;
    hasSolution: boolean;
    questions?: string[];
    confidence: number;
  }> {
    const prompt = `Analyze this user response in the context of their support ticket:

Ticket: ${ticket.title}
Previous context: ${JSON.stringify(context.ticketAnalysis)}
User response: ${userMessage}

Determine:
1. Does this provide enough info to propose a solution?
2. Do we need more clarifying questions?
3. What is our confidence in understanding the issue?

Respond with JSON:
{
  "needsMoreInfo": true/false,
  "hasSolution": true/false,
  "questions": ["question if needed"],
  "confidence": 0.0-1.0
}`;

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are analyzing user responses for support tickets.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    try {
      const content = response.choices[0]?.message?.content;
      return JSON.parse(content || '{}');
    } catch {
      return { needsMoreInfo: true, hasSolution: false, confidence: 0.5 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ESCALATION RULES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check escalation rules:
   * - confidence < 0.7
   * - severity === 'critical'
   * - user requests human
   * - no solution after 3 attempts
   * - security keywords detected
   */
  private checkEscalationRules(
    ticket: any,
    analysis: TicketAnalysisResult,
    context: AgentContextData
  ): { shouldEscalate: boolean; reason: string } {
    // Rule 1: Critical severity
    if (analysis.severity === 'critical' || ticket.severity === 'critical') {
      return {
        shouldEscalate: true,
        reason: 'Critical severity issue requires human attention',
      };
    }

    // Rule 2: Low confidence
    if (analysis.confidence < this.CONFIDENCE_THRESHOLD) {
      // Don't escalate immediately on low confidence - try to gather more info first
      // Only escalate if this is a retry
      if (context.conversation && context.conversation.length > 0) {
        return {
          shouldEscalate: true,
          reason: `Confidence too low (${analysis.confidence}) after clarification`,
        };
      }
    }

    // Rule 3: Security keywords detected
    const ticketText =
      `${ticket.title} ${ticket.description || ''} ${analysis.summary}`.toLowerCase();
    const securityKeyword = SECURITY_KEYWORDS.find(keyword => ticketText.includes(keyword));
    if (securityKeyword) {
      return {
        shouldEscalate: true,
        reason: `Security-related issue detected: ${securityKeyword}`,
      };
    }

    // Rule 4: User requests human in initial message
    const humanRequest = HUMAN_REQUEST_KEYWORDS.find(keyword => ticketText.includes(keyword));
    if (humanRequest) {
      return {
        shouldEscalate: true,
        reason: 'User requested human assistance',
      };
    }

    return { shouldEscalate: false, reason: '' };
  }

  /**
   * Calculate confidence based on analysis and similar tickets
   */
  private calculateConfidence(
    analysis: TicketAnalysisResult,
    similarTickets: SimilarTicketResult[],
    githubIssues: GithubIssueResult[]
  ): number {
    let confidence = analysis.confidence;

    // Boost confidence if we found highly similar resolved tickets
    const resolvedSimilar = similarTickets.filter(
      t => t.status === 'resolved' && t.similarity > 0.8
    );
    if (resolvedSimilar.length > 0) {
      confidence = Math.min(1.0, confidence + 0.15);
    }

    // Slight boost if we found related GitHub issues
    if (githubIssues.length > 0) {
      confidence = Math.min(1.0, confidence + 0.05);
    }

    return confidence;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHANNEL HANDLERS (Email, GitHub, Chat)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Determine the best channel for communication
   */
  private determineChannel(ticket: any): Channel {
    // If ticket came from GitHub, respond on GitHub
    if (ticket.githubIssues?.length > 0) {
      return 'github';
    }

    // If user has email and prefers email
    if (ticket.reporter?.email && ticket.userContext?.preferEmail) {
      return 'email';
    }

    // Default to chat
    return 'chat';
  }

  /**
   * Send question through specified channel
   */
  private async askQuestion(
    session: AgentSessionData,
    ticket: any,
    question: string,
    channel: Channel
  ): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmailQuestion(ticket, question);
        break;

      case 'github':
        await this.sendGithubComment(ticket, question);
        break;

      case 'chat':
      default:
        await this.sendChatMessage(session, question);
        break;
    }

    // Record the message
    await this.prisma.agentMessage.create({
      data: {
        sessionId: session.id,
        role: 'agent',
        content: question,
        channel,
      },
    });
  }

  /**
   * Propose solution through specified channel
   */
  private async proposeSolution(
    session: AgentSessionData,
    ticket: any,
    solution: ProposedSolution,
    channel: Channel
  ): Promise<void> {
    const message = this.formatSolutionMessage(solution);

    switch (channel) {
      case 'email':
        await this.sendEmailSolution(ticket, solution);
        break;

      case 'github':
        await this.sendGithubSolution(ticket, solution);
        break;

      case 'chat':
      default:
        await this.sendChatMessage(session, message);
        break;
    }

    // Record the message
    await this.prisma.agentMessage.create({
      data: {
        sessionId: session.id,
        role: 'agent',
        content: message,
        channel,
        metadata: {
          confidence: solution.confidence,
          steps: solution.steps,
        },
      },
    });
  }

  /**
   * Format solution message
   */
  private formatSolutionMessage(solution: ProposedSolution): string {
    let message = `Based on my analysis, here's a suggested solution:\n\n${solution.solution}`;

    if (solution.steps?.length) {
      message += '\n\n**Steps to resolve:**\n';
      solution.steps.forEach((step, i) => {
        message += `${i + 1}. ${step}\n`;
      });
    }

    message += '\n\nDid this help resolve your issue?';
    return message;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EMAIL CHANNEL (Resend)
  // ═══════════════════════════════════════════════════════════════════════

  private async sendEmailQuestion(ticket: any, question: string): Promise<void> {
    const email = ticket.reporter?.email;
    if (!email) {
      this.logger.warn(`No email found for ticket ${ticket.id} reporter`);
      return;
    }

    this.logger.log(`[EMAIL] Sending question to ${email}`);

    try {
      await this.emailService.sendSupportQuestion(
        email,
        ticket.id,
        ticket.title,
        question,
        ticket.reporter?.name,
        `${this.configService.get('APP_URL')}/tickets/${ticket.id}`
      );
    } catch (error) {
      this.logger.error(`Failed to send email question: ${getErrorMessage(error)}`);
    }
  }

  private async sendEmailSolution(ticket: any, solution: ProposedSolution): Promise<void> {
    const email = ticket.reporter?.email;
    if (!email) {
      this.logger.warn(`No email found for ticket ${ticket.id} reporter`);
      return;
    }

    this.logger.log(`[EMAIL] Sending solution to ${email}`);

    const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';

    try {
      await this.emailService.sendSupportSolution(
        email,
        ticket.id,
        ticket.title,
        solution.solution,
        solution.confidence,
        solution.steps,
        ticket.reporter?.name,
        `${baseUrl}/tickets/${ticket.id}?action=resolve`,
        `${baseUrl}/tickets/${ticket.id}?action=more-help`
      );
    } catch (error) {
      this.logger.error(`Failed to send email solution: ${getErrorMessage(error)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GITHUB CHANNEL
  // ═══════════════════════════════════════════════════════════════════════

  private async sendGithubComment(ticket: any, comment: string): Promise<void> {
    const githubIssue = ticket.githubIssues?.[0];
    if (!githubIssue) {
      this.logger.warn('No GitHub issue linked to ticket');
      return;
    }

    try {
      await this.githubService.addComment(
        githubIssue.githubRepo,
        githubIssue.githubIssueNumber,
        `🤖 **AI Support Agent**\n\n${comment}`
      );
    } catch (error) {
      this.logger.error(`Failed to add GitHub comment: ${getErrorMessage(error)}`);
    }
  }

  private async sendGithubSolution(ticket: any, solution: ProposedSolution): Promise<void> {
    const message = this.formatSolutionMessage(solution);
    await this.sendGithubComment(ticket, message);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IN-APP CHAT CHANNEL
  // ═══════════════════════════════════════════════════════════════════════

  private async sendChatMessage(session: AgentSessionData, message: string): Promise<void> {
    // Messages are stored in agent_messages table and can be fetched by the frontend
    this.logger.log(`[CHAT] Message for session ${session.id}: ${message.substring(0, 50)}...`);

    // The message is already being stored by askQuestion/proposeSolution
    // Frontend can poll or use WebSocket to get new messages
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════

  private isActiveState(state: AgentState): boolean {
    return ['ANALYZING', 'NEEDS_INFO', 'PROPOSING', 'WAITING'].includes(state);
  }

  private isTerminalState(state: AgentState): boolean {
    return ['RESOLVED', 'ESCALATED'].includes(state);
  }

  private async updateSession(
    sessionId: string,
    data: {
      state: AgentState;
      attempts: number;
      confidence: number;
      context: AgentContextData;
    }
  ): Promise<void> {
    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        status: data.state,
        agentState: JSON.parse(
          JSON.stringify({
            state: data.state,
            attempts: data.attempts,
            confidence: data.confidence,
            context: data.context,
          })
        ),
        lastActionAt: new Date(),
      },
    });
  }

  private async getLatestUserMessage(
    sessionId: string
  ): Promise<{ content: string; channel: string } | null> {
    const message = await this.prisma.agentMessage.findFirst({
      where: {
        sessionId,
        role: 'user',
      },
      orderBy: { createdAt: 'desc' },
    });

    return message ? { content: message.content, channel: message.channel || 'chat' } : null;
  }

  private userRequestsHuman(message: string): boolean {
    const lower = message.toLowerCase();
    return HUMAN_REQUEST_KEYWORDS.some(keyword => lower.includes(keyword));
  }

  private userConfirmsResolution(message: string): boolean {
    const confirmationKeywords = [
      'yes',
      'thanks',
      'thank you',
      'that worked',
      'solved',
      'fixed',
      'resolved',
      'perfect',
      'great',
    ];
    const lower = message.toLowerCase();
    return confirmationKeywords.some(keyword => lower.includes(keyword));
  }

  private async escalateTicket(
    session: AgentSessionData,
    ticket: any,
    options: { reason: string; priority?: string; assignee?: string }
  ): Promise<void> {
    this.logger.log(`Escalating ticket ${ticket.id}: ${options.reason}`);

    // Find available support agent
    let assigneeId = options.assignee;
    if (!assigneeId) {
      const supportAgent = await this.prisma.user.findFirst({
        where: {
          tenantId: ticket.tenantId,
          role: { in: ['admin', 'support'] },
        },
      });
      assigneeId = supportAgent?.id;
    }

    // Update session
    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: 'ESCALATED',
        escalatedTo: assigneeId,
        escalationReason: options.reason,
      },
    });

    // Update ticket
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'escalated',
        assignedTo: assigneeId,
        assignedAt: new Date(),
        priority: options.priority === 'critical' ? 10 : options.priority === 'high' ? 7 : 5,
      },
    });

    // Send notification to assignee
    await this.sendEscalationNotification(ticket, options.reason, assigneeId);
  }

  private async resolveTicket(session: AgentSessionData, ticket: any): Promise<void> {
    this.logger.log(`Resolving ticket ${ticket.id}`);

    await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: 'RESOLVED',
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });
  }

  private async sendEscalationNotification(
    ticket: any,
    reason: string,
    assigneeId?: string
  ): Promise<void> {
    this.logger.log(
      `[NOTIFICATION] Escalation for ticket ${ticket.id} to ${assigneeId}: ${reason}`
    );

    // Get assignee email
    let assigneeEmail: string | undefined;
    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });
      assigneeEmail = assignee?.email;
    }

    // Fallback to admin users if no assignee
    if (!assigneeEmail) {
      const admin = await this.prisma.user.findFirst({
        where: {
          tenantId: ticket.tenantId,
          role: 'admin',
        },
      });
      assigneeEmail = admin?.email;
    }

    if (assigneeEmail) {
      const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3000';

      try {
        await this.emailService.sendEscalationNotification(
          assigneeEmail,
          ticket.id,
          ticket.title,
          reason,
          ticket.priority >= 7 ? 'high' : ticket.priority >= 4 ? 'medium' : 'low',
          ticket.reporter?.name,
          ticket.reporter?.email,
          ticket.aiSummary,
          `${baseUrl}/tickets/${ticket.id}`
        );
      } catch (error) {
        this.logger.error(`Failed to send escalation notification: ${getErrorMessage(error)}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Handle incoming user message
   */
  async handleUserMessage(
    sessionId: string,
    message: string,
    channel: Channel = 'chat'
  ): Promise<void> {
    // Store the message
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
        channel,
      },
    });

    // Get session and ticket
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { ticket: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // If session is waiting, trigger processing
    if (session.status === 'WAITING') {
      const sessionData: AgentSessionData = {
        id: session.id,
        ticketId: session.ticketId,
        tenantId: session.ticket.tenantId,
        state: session.status as AgentState,
        attempts: (session.agentState as any)?.attempts || 0,
        confidence: (session.agentState as any)?.confidence || 0,
        context: (session.agentState as any)?.context || { conversation: [] },
        createdAt: session.createdAt,
        updatedAt: session.lastActionAt,
      };

      // Run the agent loop asynchronously
      this.runAgentLoop(sessionData, session.ticket).catch(error => {
        this.logger.error(`Agent loop error: ${getErrorMessage(error)}`, getErrorStack(error));
      });
    }
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(m => ({
      role: m.role as 'user' | 'agent' | 'system',
      content: m.content,
      channel: (m.channel || 'chat') as Channel,
      timestamp: m.createdAt,
      metadata: m.metadata as Record<string, unknown>,
    }));
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<{
    state: AgentState;
    confidence: number;
    attempts: number;
  }> {
    const session = await this.prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const state = session.agentState as any;
    return {
      state: session.status as AgentState,
      confidence: state?.confidence || 0,
      attempts: state?.attempts || 0,
    };
  }
}

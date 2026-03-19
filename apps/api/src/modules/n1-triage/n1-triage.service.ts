import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { AiPromptConfigService } from '../ai-config/ai-prompt-config.service';
import { sanitizeForPrompt } from '../../common/utils/prompt-sanitizer';
import { TicketRelationsService } from '../ticket-relations/ticket-relations.service';

interface N1Assessment {
  decision: 'no_fix_needed' | 'duplicate' | 'escalate_n2';
  confidence: number;
  reasoning: string;
  duplicateTicketId?: string;
  userResponse: string;
  escalationContext?: string;
  investigationHints?: string[];
  similarTicketIds?: string[];
}

interface N1Context {
  ticket: {
    id: string;
    title: string | null;
    description: string | null;
    aiSummary: string | null;
    type: string | null;
    typeConfidence: unknown;
    severity: string | null;
    keywords: string[];
    userContext: Record<string, unknown> | null;
    workingAsIntendedConfidence: number | null;
  };
  ocrTexts: string[];
  visualCues: { errors: string[]; urls: string[]; components: string[] };
  similarTickets: Array<{
    id: string;
    title: string | null;
    status: string;
    type: string | null;
    severity: string | null;
    aiSummary: string | null;
    diagnosis: unknown;
    similarity: number;
    resolvedAt: Date | null;
    lastAgentMessage: string | null;
  }>;
}

const N1_SYSTEM_PROMPT = `You are a Level 1 support triage agent. Your job is to quickly assess bug reports and determine whether they can be resolved now without a full code investigation.

You have access to the ticket details, video analysis results (OCR text, visual cues), and similar resolved tickets from the database.

## Core Principle

Your default question is: "Can I resolve this ticket right now without N2 investigation?"
Escalation to N2 is a last resort — only when no available information allows a resolution.

## Pre-Decision Checklist

Work through this checklist in order before choosing a decision. Stop as soon as a condition is met.

**Step 1 — Duplicate check**
- Similarity > 0.92: this is a certain duplicate → decision: "duplicate"
- Similarity 0.85–0.92: probable duplicate — verify the symptoms and error messages genuinely match → if yes: "duplicate", if context differs: continue checklist
- Similarity < 0.85: not a duplicate, continue

**Step 2 — Resolvable without code change**
- Is the error a known pattern (404, CORS, timeout, ERR_CONNECTION_REFUSED, SSL, DNS)? → decision: "no_fix_needed" with a clear explanation of the cause
- Does the ticket type appear to be "question" or "feature_request" misclassified as a bug? → decision: "no_fix_needed"
- Does the issue look like user error, misconfiguration, wrong environment, or missing dependency? → decision: "no_fix_needed"
- Is the behavior working as intended based on classification context (workingAsIntendedConfidence > 0.7)? → strong presumption of "no_fix_needed"
- Does a resolved similar ticket describe the same root cause with a deployed fix? → decision: "no_fix_needed" with reference to that fix

**Step 3 — Escalate only if none of the above apply**
- Unknown stack trace with no similar resolved ticket
- Undocumented error that cannot be explained by configuration or user error
- Clear evidence of a code regression (worked before, now broken, no config change)
→ decision: "escalate_n2" with specific investigationHints

## Decision Options

1. **"no_fix_needed"** — The issue can be explained and resolved without a code change:
   - User error, misconfiguration, or expected behavior
   - Known error pattern (404, CORS, timeout, etc.) with a clear cause
   - Misclassified question or feature request
   - Already fixed in a recent release
   - Explain clearly WHY no code fix is needed

2. **"duplicate"** — A resolved or in-progress ticket already covers this issue:
   - Similarity > 0.85 AND the symptoms/errors genuinely match
   - Reference the original ticket ID

3. **"escalate_n2"** — Only when no available information allows resolution:
   - Unknown bug, no matching resolved ticket, cannot be explained by user error or configuration
   - Provide specific investigationHints (file paths, component names, error patterns)

## Structured Reasoning Requirement

Your "reasoning" field must walk through the checklist steps explicitly:
1. What is the highest similarity score found and does it match?
2. Are there any known error patterns in the OCR or visual cues?
3. What is the ticket type and classification confidence?
4. What do resolved similar tickets tell you?
5. Conclusion: which checklist step triggered your decision?

## Rules
- Always provide a userResponse that explains the decision clearly to the reporter
- When escalating, provide specific investigationHints (file paths, component names, error patterns)
- Only mark as duplicate if similarity > 0.85 AND the context genuinely matches
- Do not escalate to N2 simply because you are uncertain — use the available data`;

const N1_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    decision: {
      type: 'string',
      enum: ['no_fix_needed', 'duplicate', 'escalate_n2'],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    reasoning: {
      type: 'string',
    },
    duplicateTicketId: {
      type: 'string',
    },
    userResponse: {
      type: 'string',
    },
    escalationContext: {
      type: 'string',
    },
    investigationHints: {
      type: 'array',
      items: { type: 'string' },
    },
    similarTicketIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['decision', 'confidence', 'reasoning', 'userResponse'],
};

@Injectable()
export class N1TriageService {
  private readonly logger = new Logger(N1TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly aiPromptConfigService: AiPromptConfigService,
    private readonly ticketRelationsService: TicketRelationsService,
    @InjectQueue('deep-analysis') private readonly deepAnalysisQueue: Queue
  ) {}

  async assess(
    ticketId: string,
    tenantId: string,
    applicationId: string
  ): Promise<{ success: boolean; decision: string | null; error?: string }> {
    const startTime = Date.now();
    this.logger.log(`N1 assessment starting for ticket ${ticketId}`);

    try {
      // Step 1: Build N1 context
      const context = await this.buildN1Context(ticketId, tenantId);
      if (!context) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      // Step 2: Find similar tickets
      const similarTickets = await this.findSimilarTickets(ticketId, tenantId);
      context.similarTickets = similarTickets;

      // Step 3: Run AI assessment
      const assessment = await this.runAssessment(context, tenantId);

      // Step 4: Execute decision
      await this.executeDecision(ticketId, tenantId, applicationId, assessment);

      const duration = Date.now() - startTime;
      this.logger.log(
        `N1 assessment complete for ticket ${ticketId}: decision=${assessment.decision}, confidence=${assessment.confidence} (${duration}ms)`
      );

      return { success: true, decision: assessment.decision };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`N1 assessment failed for ticket ${ticketId}: ${message}`);

      // Record failure event
      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          tenantId,
          eventType: 'n1_assessment_failed',
          data: { error: message, duration: Date.now() - startTime },
        },
      });

      return { success: false, decision: null, error: message };
    }
  }

  /**
   * Build context for the N1 assessment from ticket data + media analysis.
   */
  private async buildN1Context(ticketId: string, tenantId: string): Promise<N1Context | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: {
          select: {
            metadata: true,
            videoEvents: {
              where: { ocrText: { not: null } },
              orderBy: { timestampMs: 'asc' },
              take: 20,
            },
          },
        },
      },
    });

    if (!ticket) return null;

    // Extract OCR text
    const ocrTexts = ticket.media
      .flatMap(m =>
        m.videoEvents.filter(e => e.ocrText).map(e => `[${e.timestampMs ?? 0}ms] ${e.ocrText}`)
      )
      .filter(Boolean);

    // Extract visual cues
    const visualCues = { errors: [] as string[], urls: [] as string[], components: [] as string[] };
    for (const m of ticket.media) {
      const cues = (m.metadata as Record<string, unknown>)?.['visualCues'] as
        | typeof visualCues
        | undefined;
      if (!cues) continue;
      visualCues.errors.push(...(cues.errors ?? []));
      visualCues.urls.push(...(cues.urls ?? []));
      visualCues.components.push(...(cues.components ?? []));
    }

    // Extract workingAsIntendedConfidence from aiAnalysis JSON (stored by triage)
    const aiAnalysis = ticket.aiAnalysis as Record<string, unknown> | null;
    const workingAsIntendedConfidence =
      typeof aiAnalysis?.['workingAsIntendedConfidence'] === 'number'
        ? (aiAnalysis['workingAsIntendedConfidence'] as number)
        : null;

    // Extract userContext
    const userContext = ticket.userContext as Record<string, unknown> | null;

    return {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        aiSummary: ticket.aiSummary,
        type: ticket.type,
        typeConfidence: ticket.typeConfidence,
        severity: ticket.severity,
        keywords: ticket.keywords,
        userContext,
        workingAsIntendedConfidence,
      },
      ocrTexts,
      visualCues: {
        errors: [...new Set(visualCues.errors)].slice(0, 10),
        urls: [...new Set(visualCues.urls)].slice(0, 10),
        components: [...new Set(visualCues.components)].slice(0, 15),
      },
      similarTickets: [],
    };
  }

  private static readonly SIMILAR_TICKET_LIMIT = 10;
  private static readonly SIMILARITY_THRESHOLD = 0.6;

  /**
   * Find similar tickets using pgvector cosine similarity, with keyword fallback.
   * Returns up to 10 tickets with similarity > 0.6, enriched with resolution data.
   */
  private async findSimilarTickets(
    ticketId: string,
    tenantId: string,
    limit: number = N1TriageService.SIMILAR_TICKET_LIMIT
  ): Promise<N1Context['similarTickets']> {
    try {
      const similar = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string | null;
          status: string;
          type: string | null;
          severity: string | null;
          ai_summary: string | null;
          diagnosis: unknown;
          similarity: number;
          resolved_at: Date | null;
          updated_at: Date;
          last_agent_message: string | null;
        }>
      >`
        WITH ref AS (
          SELECT embedding FROM tickets WHERE id = ${ticketId} LIMIT 1
        ),
        similar_base AS (
          SELECT
            t.id, t.title, t.status, t.type, t.severity,
            t.ai_summary, t.diagnosis,
            t.resolved_at, t.updated_at,
            1 - (t.embedding <-> ref.embedding) as similarity
          FROM tickets t, ref
          WHERE
            t."tenantId" = ${tenantId}
            AND t.id != ${ticketId}
            AND t.embedding IS NOT NULL
            AND t.status IN ('resolved', 'closed', 'analyzed', 'fix_proposed', 'merged')
          ORDER BY t.embedding <-> ref.embedding
          LIMIT ${limit}
        ),
        with_agent_message AS (
          SELECT
            sb.*,
            (
              SELECT am.content
              FROM agent_sessions s
              JOIN agent_messages am ON am.session_id = s.id
              WHERE s.ticket_id = sb.id
                AND am.role IN ('assistant', 'system')
              ORDER BY am.created_at DESC
              LIMIT 1
            ) as last_agent_message
          FROM similar_base sb
        )
        SELECT * FROM with_agent_message
        WHERE similarity > ${N1TriageService.SIMILARITY_THRESHOLD}
      `;

      return similar
        .filter(t => t.similarity > N1TriageService.SIMILARITY_THRESHOLD)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          type: t.type,
          severity: t.severity,
          aiSummary: t.ai_summary,
          diagnosis: t.diagnosis,
          similarity: t.similarity,
          resolvedAt: t.resolved_at ?? null,
          lastAgentMessage: t.last_agent_message ?? null,
        }));
    } catch (error) {
      this.logger.warn(
        `Vector search failed for ticket ${ticketId}, falling back to keywords: ${(error as Error).message}`
      );
      return this.findSimilarByKeywords(ticketId, tenantId, limit);
    }
  }

  private async findSimilarByKeywords(
    ticketId: string,
    tenantId: string,
    limit: number
  ): Promise<N1Context['similarTickets']> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      select: { keywords: true, title: true },
    });

    if (!ticket || ticket.keywords.length === 0) return [];

    const results = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        id: { not: ticketId },
        status: { in: ['resolved', 'closed', 'analyzed', 'fix_proposed', 'merged'] },
        OR: [
          { keywords: { hasSome: ticket.keywords } },
          ...(ticket.title
            ? [{ title: { contains: ticket.title.split(' ')[0], mode: 'insensitive' as const } }]
            : []),
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        severity: true,
        aiSummary: true,
        diagnosis: true,
        resolvedAt: true,
      },
    });

    return results.map(t => ({
      ...t,
      similarity: 0.5,
      resolvedAt: t.resolvedAt ?? null,
      lastAgentMessage: null,
    }));
  }

  /**
   * Run AI assessment — single call, no agentic loop.
   */
  private async runAssessment(context: N1Context, tenantId: string): Promise<N1Assessment> {
    const prompt = this.buildN1Prompt(context);
    const provider = await this.aiService.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider — defaulting to escalate_n2');
      return {
        decision: 'escalate_n2',
        confidence: 0.3,
        reasoning: 'No AI provider configured — escalating by default',
        userResponse: 'Your bug report is being reviewed by our engineering team.',
        escalationContext: 'AI provider unavailable, manual investigation needed',
      };
    }

    try {
      const customInstructions = await this.aiPromptConfigService.buildCustomInstructions(
        tenantId,
        'n1_triage'
      );
      const systemPrompt = N1_SYSTEM_PROMPT + customInstructions;

      const result = await provider.generateStructuredOutput<N1Assessment>(
        prompt,
        N1_OUTPUT_SCHEMA,
        {
          systemPrompt,
          temperature: 0.1,
          maxTokens: 1024,
        }
      );

      return result;
    } catch (error) {
      this.logger.error(`N1 AI assessment failed: ${(error as Error).message}`);
      return {
        decision: 'escalate_n2',
        confidence: 0.3,
        reasoning: `AI assessment failed: ${(error as Error).message}`,
        userResponse: 'Your bug report is being reviewed by our engineering team.',
        escalationContext: 'AI assessment failed, manual investigation needed',
      };
    }
  }

  private buildN1Prompt(context: N1Context): string {
    const parts: string[] = [];

    const safeTitle = sanitizeForPrompt(context.ticket.title, {
      maxLength: 500,
      fieldName: 'title',
    });
    const safeDescription = sanitizeForPrompt(context.ticket.description, {
      maxLength: 10_000,
      fieldName: 'description',
    });

    parts.push('## TICKET');
    parts.push(`Title: ${safeTitle || 'No title'}`);
    parts.push(`Description: ${safeDescription || 'No description'}`);

    if (context.ticket.aiSummary) {
      const safeAiSummary = sanitizeForPrompt(context.ticket.aiSummary, {
        maxLength: 2000,
        fieldName: 'ai_summary',
      });
      parts.push(`AI Video Summary: ${safeAiSummary}`);
    }

    parts.push(
      `Type: ${context.ticket.type || 'unknown'} (confidence: ${context.ticket.typeConfidence ?? 'N/A'})`
    );
    parts.push(`Severity: ${context.ticket.severity || 'unknown'}`);

    // workingAsIntendedConfidence signal — strong hint for no_fix_needed
    if (
      context.ticket.workingAsIntendedConfidence !== null &&
      context.ticket.workingAsIntendedConfidence > 0.7
    ) {
      parts.push(
        `\nSIGNAL: Triage classification indicates this may be working as intended (confidence: ${context.ticket.workingAsIntendedConfidence.toFixed(2)})`
      );
    }

    // User environment
    if (context.ticket.userContext && Object.keys(context.ticket.userContext).length > 0) {
      const uc = context.ticket.userContext;
      parts.push('\n## USER ENVIRONMENT');
      if (uc['browser']) parts.push(`Browser: ${uc['browser']}`);
      if (uc['os']) parts.push(`OS: ${uc['os']}`);
      if (uc['viewport']) parts.push(`Viewport: ${uc['viewport']}`);
      if (uc['url']) parts.push(`URL: ${uc['url']}`);
      const extra = Object.entries(uc)
        .filter(([k]) => !['browser', 'os', 'viewport', 'url'].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (extra) parts.push(extra);
    }

    if (context.ocrTexts.length > 0) {
      parts.push('\n## VIDEO OCR TEXT');
      parts.push(context.ocrTexts.slice(0, 10).join('\n'));
    }

    if (context.visualCues.errors.length > 0) {
      parts.push('\n## VISIBLE ERROR MESSAGES');
      parts.push(context.visualCues.errors.join('\n'));
    }

    if (context.visualCues.urls.length > 0) {
      parts.push('\n## VISIBLE URLS');
      parts.push(context.visualCues.urls.join(', '));
    }

    if (context.similarTickets.length > 0) {
      parts.push('\n## SIMILAR RESOLVED TICKETS');
      for (const t of context.similarTickets) {
        const diag = t.diagnosis as {
          rootCause?: string;
          suggestedFix?: string;
          affectedFiles?: string[];
        } | null;
        parts.push(
          `- [${t.id}] "${t.title}" (status: ${t.status}, similarity: ${Math.round(t.similarity * 100)}%)`
        );
        if (t.resolvedAt) {
          parts.push(`  Resolved: ${t.resolvedAt.toISOString().split('T')[0]}`);
        }
        if (t.aiSummary) parts.push(`  Summary: ${t.aiSummary}`);
        if (diag?.rootCause) parts.push(`  Root cause: ${diag.rootCause}`);
        if (diag?.suggestedFix) parts.push(`  Fix: ${diag.suggestedFix}`);
        if (diag?.affectedFiles && diag.affectedFiles.length > 0) {
          parts.push(`  Affected files: ${diag.affectedFiles.slice(0, 5).join(', ')}`);
        }
        if (t.lastAgentMessage) {
          parts.push(`  Resolution: ${t.lastAgentMessage.slice(0, 500)}`);
        }
      }
    } else {
      parts.push('\n## SIMILAR TICKETS');
      parts.push('No similar resolved tickets found.');
    }

    parts.push('\nAssess this ticket now.');

    return parts.join('\n');
  }

  /**
   * Execute the N1 decision: update ticket, create events, and optionally escalate.
   */
  private async executeDecision(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    assessment: N1Assessment
  ): Promise<void> {
    // Save N1 assessment on ticket
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        n1Assessment: assessment as object,
        n1Decision: assessment.decision,
        n1AssessedAt: new Date(),
      },
    });

    // Create ticket relations from assessment (duplicate/similar links)
    await this.ticketRelationsService.createFromN1Assessment(ticketId, tenantId, {
      duplicateTicketId: assessment.duplicateTicketId,
      similarTicketIds: assessment.similarTicketIds,
      confidence: assessment.confidence,
    });

    // Record timeline event
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'n1_assessment_completed',
        data: {
          decision: assessment.decision,
          confidence: assessment.confidence,
          reasoning: assessment.reasoning,
          duplicateTicketId: assessment.duplicateTicketId,
        },
      },
    });

    // Save the N1 response as an agent message (visible in chat)
    await this.saveN1Message(ticketId, assessment);

    switch (assessment.decision) {
      case 'no_fix_needed':
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'resolved', resolvedAt: new Date() },
        });
        this.logger.log(`Ticket ${ticketId}: N1 resolved as no_fix_needed`);
        break;

      case 'duplicate':
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'closed' },
        });
        this.logger.log(
          `Ticket ${ticketId}: N1 closed as duplicate of ${assessment.duplicateTicketId}`
        );
        break;

      case 'escalate_n2':
        await this.deepAnalysisQueue.add(
          'analyze',
          {
            ticketId,
            tenantId,
            applicationId,
            n1Context: {
              reasoning: assessment.escalationContext || assessment.reasoning,
              investigationHints: assessment.investigationHints,
              similarTicketIds: assessment.similarTicketIds,
            },
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 30000 },
            removeOnComplete: 50,
            removeOnFail: 100,
          }
        );
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'analyzing' },
        });
        this.logger.log(`Ticket ${ticketId}: N1 escalated to N2 deep analysis`);
        break;
    }
  }

  /**
   * Save the N1 assessment as a visible message in the ticket's agent session.
   */
  private async saveN1Message(ticketId: string, assessment: N1Assessment): Promise<void> {
    // Find or create an agent session for this ticket
    let session = await this.prisma.agentSession.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      session = await this.prisma.agentSession.create({
        data: {
          ticketId,
          status: 'active',
          agentState: { version: 'n1-triage', step: 'assessment' },
        },
      });
    }

    const decisionLabel = {
      no_fix_needed: 'No Fix Needed',
      duplicate: 'Duplicate',
      escalate_n2: 'Escalated to Investigation',
    }[assessment.decision];

    const lines: string[] = [];
    lines.push(`## N1 Triage: ${decisionLabel}`);
    lines.push('');
    lines.push(assessment.userResponse);
    lines.push('');
    lines.push(`**Confidence:** ${Math.round(assessment.confidence * 100)}%`);

    if (assessment.decision === 'duplicate' && assessment.duplicateTicketId) {
      lines.push(`**Duplicate of:** Ticket ${assessment.duplicateTicketId}`);
    }

    if (assessment.decision === 'escalate_n2') {
      lines.push('');
      lines.push('*A deeper code investigation has been launched automatically.*');
    }

    await this.prisma.agentMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: lines.join('\n'),
        metadata: {
          type: 'n1_assessment',
          decision: assessment.decision,
          confidence: assessment.confidence,
        },
      },
    });
  }

  /**
   * Get the N1 assessment for a ticket (dashboard endpoint).
   */
  async getAssessment(ticketId: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        n1Assessment: true,
        n1Decision: true,
        n1AssessedAt: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ticketId: ticket.id,
      assessment: ticket.n1Assessment,
      decision: ticket.n1Decision,
      assessedAt: ticket.n1AssessedAt,
    };
  }

  /**
   * Override N1 decision — force escalation to N2.
   */
  async overrideDecision(ticketId: string, tenantId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, applicationId: true, n1Decision: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Enqueue deep analysis
    await this.deepAnalysisQueue.add(
      'analyze',
      {
        ticketId,
        tenantId,
        applicationId: ticket.applicationId,
        n1Context: {
          reasoning: 'Manual override — N1 decision overridden by user, forcing deep analysis',
        },
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      }
    );

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'analyzing',
        n1Decision: 'escalate_n2',
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'n1_decision_overridden',
        data: { previousDecision: ticket.n1Decision, newDecision: 'escalate_n2' },
      },
    });

    this.logger.log(`Ticket ${ticketId}: N1 decision overridden to escalate_n2`);
  }
}

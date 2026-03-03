import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';

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
  }>;
}

const N1_SYSTEM_PROMPT = `You are a Level 1 support triage agent. Your job is to quickly assess bug reports and decide if code investigation is needed.

You have access to the ticket details, video analysis results (OCR text, visual cues), and similar resolved tickets from the database.

## Decision Options

1. **"no_fix_needed"** — Use when:
   - User error or misconfiguration
   - Expected behavior that user misunderstands
   - Issue already fixed in a recent release
   - Environment/setup issue (wrong browser, missing dependency)
   - Explain clearly WHY no code fix is needed

2. **"duplicate"** — Use when:
   - A very similar ticket has already been resolved or is being investigated
   - The symptoms, error messages, and context closely match an existing ticket
   - Reference the original ticket ID

3. **"escalate_n2"** — Use when:
   - A real code bug that needs investigation
   - The issue cannot be explained by user error or configuration
   - No matching duplicate found
   - Provide hints about which files/areas to investigate

## Rules
- Be concise but thorough in your reasoning
- Always provide a userResponse that explains the decision to the reporter
- When escalating, provide specific investigationHints (file paths, component names, error patterns)
- Only mark as duplicate if similarity is very high and the tickets genuinely describe the same issue
- Default to escalate_n2 if uncertain — it's better to investigate than to dismiss a real bug`;

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

const MAX_VIDEO_WAIT_MS = 90_000;
const VIDEO_POLL_INTERVAL_MS = 3_000;

@Injectable()
export class N1TriageService {
  private readonly logger = new Logger(N1TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    @InjectQueue('deep-analysis') private readonly deepAnalysisQueue: Queue,
  ) {}

  async assess(
    ticketId: string,
    tenantId: string,
    applicationId: string,
  ): Promise<{ success: boolean; decision: string | null; error?: string }> {
    const startTime = Date.now();
    this.logger.log(`N1 assessment starting for ticket ${ticketId}`);

    try {
      // Step 1: Wait for video analysis to complete
      await this.waitForVideoAnalysis(ticketId);

      // Step 2: Build N1 context
      const context = await this.buildN1Context(ticketId, tenantId);
      if (!context) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      // Step 3: Find similar tickets
      const similarTickets = await this.findSimilarTickets(ticketId, tenantId);
      context.similarTickets = similarTickets;

      // Step 4: Run AI assessment
      const assessment = await this.runAssessment(context);

      // Step 5: Execute decision
      await this.executeDecision(ticketId, tenantId, applicationId, assessment);

      const duration = Date.now() - startTime;
      this.logger.log(
        `N1 assessment complete for ticket ${ticketId}: decision=${assessment.decision}, confidence=${assessment.confidence} (${duration}ms)`,
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
   * Wait for video analysis to complete (max 90s with 3s polling).
   * If no media or already completed, returns immediately.
   */
  private async waitForVideoAnalysis(ticketId: string): Promise<void> {
    const media = await this.prisma.media.findMany({
      where: { ticketId },
      select: { id: true, processingStatus: true },
    });

    if (media.length === 0) {
      this.logger.debug(`No media for ticket ${ticketId}, skipping video wait`);
      return;
    }

    const pendingMedia = media.filter(
      (m) => m.processingStatus === 'pending' || m.processingStatus === 'processing',
    );

    if (pendingMedia.length === 0) {
      this.logger.debug(`All media already processed for ticket ${ticketId}`);
      return;
    }

    this.logger.log(
      `Waiting for ${pendingMedia.length} media item(s) to finish processing for ticket ${ticketId}`,
    );

    const deadline = Date.now() + MAX_VIDEO_WAIT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

      const current = await this.prisma.media.findMany({
        where: { ticketId, id: { in: pendingMedia.map((m) => m.id) } },
        select: { id: true, processingStatus: true },
      });

      const stillPending = current.filter(
        (m) => m.processingStatus === 'pending' || m.processingStatus === 'processing',
      );

      if (stillPending.length === 0) {
        this.logger.log(`All media processing complete for ticket ${ticketId}`);
        return;
      }
    }

    this.logger.warn(
      `Video analysis timeout (${MAX_VIDEO_WAIT_MS}ms) for ticket ${ticketId} — proceeding with available data`,
    );
  }

  /**
   * Build context for the N1 assessment from ticket data + media analysis.
   */
  private async buildN1Context(
    ticketId: string,
    tenantId: string,
  ): Promise<N1Context | null> {
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
      .flatMap((m) =>
        m.videoEvents
          .filter((e) => e.ocrText)
          .map((e) => `[${e.timestampMs ?? 0}ms] ${e.ocrText}`),
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

  /**
   * Find similar tickets using pgvector cosine similarity, with keyword fallback.
   */
  private async findSimilarTickets(
    ticketId: string,
    tenantId: string,
    limit: number = 5,
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
        }>
      >`
        SELECT
          id, title, status, type, severity,
          ai_summary, diagnosis,
          1 - (embedding <-> (SELECT embedding FROM tickets WHERE id = ${ticketId})) as similarity
        FROM tickets
        WHERE
          "tenantId" = ${tenantId}
          AND id != ${ticketId}
          AND embedding IS NOT NULL
          AND status IN ('resolved', 'closed', 'analyzed', 'fix_proposed', 'merged')
        ORDER BY embedding <-> (SELECT embedding FROM tickets WHERE id = ${ticketId})
        LIMIT ${limit}
      `;

      return similar.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        type: t.type,
        severity: t.severity,
        aiSummary: t.ai_summary,
        diagnosis: t.diagnosis,
        similarity: t.similarity,
      }));
    } catch (error) {
      this.logger.warn(
        `Vector search failed for ticket ${ticketId}, falling back to keywords: ${(error as Error).message}`,
      );
      return this.findSimilarByKeywords(ticketId, tenantId, limit);
    }
  }

  private async findSimilarByKeywords(
    ticketId: string,
    tenantId: string,
    limit: number,
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
      },
    });

    return results.map((t) => ({ ...t, similarity: 0.5 }));
  }

  /**
   * Run AI assessment — single call, no agentic loop.
   */
  private async runAssessment(context: N1Context): Promise<N1Assessment> {
    const prompt = this.buildN1Prompt(context);
    const provider = await this.aiService.getActiveProvider(context.ticket.id);

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
      const result = await provider.generateStructuredOutput<N1Assessment>(
        prompt,
        N1_OUTPUT_SCHEMA,
        {
          systemPrompt: N1_SYSTEM_PROMPT,
          temperature: 0.1,
          maxTokens: 1024,
        },
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

    parts.push('## TICKET');
    parts.push(`Title: ${context.ticket.title || 'No title'}`);
    parts.push(`Description: ${context.ticket.description || 'No description'}`);

    if (context.ticket.aiSummary) {
      parts.push(`AI Video Summary: ${context.ticket.aiSummary}`);
    }

    parts.push(`Type: ${context.ticket.type || 'unknown'} (confidence: ${context.ticket.typeConfidence ?? 'N/A'})`);
    parts.push(`Severity: ${context.ticket.severity || 'unknown'}`);

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
        const diag = t.diagnosis as { rootCause?: string; suggestedFix?: string } | null;
        parts.push(`- [${t.id}] "${t.title}" (status: ${t.status}, similarity: ${Math.round(t.similarity * 100)}%)`);
        if (t.aiSummary) parts.push(`  Summary: ${t.aiSummary}`);
        if (diag?.rootCause) parts.push(`  Root cause: ${diag.rootCause}`);
        if (diag?.suggestedFix) parts.push(`  Fix: ${diag.suggestedFix}`);
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
    assessment: N1Assessment,
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
          `Ticket ${ticketId}: N1 closed as duplicate of ${assessment.duplicateTicketId}`,
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
          },
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
  private async saveN1Message(
    ticketId: string,
    assessment: N1Assessment,
  ): Promise<void> {
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
  async overrideDecision(
    ticketId: string,
    tenantId: string,
  ): Promise<void> {
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
      },
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

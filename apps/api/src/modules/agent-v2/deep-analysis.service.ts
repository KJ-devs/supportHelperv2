import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CodeInvestigationService } from './code-investigation.service';
import { AgenticLoopService, AgenticLoopOptions } from './agentic-loop.service';
import { AgentMessage } from '../../ai/providers/tool-capable-provider.interface';
import { DiagnosisService, Diagnosis } from './diagnosis.service';
import { AGENT_TOOLS } from './agent-tools';

interface MediaVisualCues {
  errors: string[];
  urls: string[];
  components: string[];
}

interface TicketWithContext {
  id: string;
  tenantId: string;
  applicationId: string;
  title: string | null;
  description: string | null;
  aiSummary: string | null;
  type: string | null;
  typeConfidence: unknown;
  severity: string | null;
  keywords: string[];
  status: string;
  media: Array<{
    metadata: Record<string, unknown> | null;
    videoEvents: Array<{
      timestampMs: number | null;
      ocrText: string | null;
    }>;
  }>;
}

@Injectable()
export class DeepAnalysisService {
  private readonly logger = new Logger(DeepAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeInvestigation: CodeInvestigationService,
    private readonly agenticLoop: AgenticLoopService,
    private readonly diagnosisService: DiagnosisService,
  ) {}

  async analyze(ticketId: string, tenantId: string): Promise<Diagnosis | null> {
    const ticket = await this.loadTicketWithContext(ticketId, tenantId);

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Mark ticket as analyzing
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'analyzing' },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'analysis_started',
        data: { triggeredBy: 'agent-v2' },
      },
    });

    const repoCtx = await this.codeInvestigation.getRepoContext(ticket.applicationId);

    // Get repo structure for the system prompt (or empty string if no repo)
    let repoStructure = 'No repository connected to this application.';
    if (repoCtx) {
      try {
        repoStructure = await this.codeInvestigation.getRepoStructure(repoCtx);
      } catch (err) {
        this.logger.warn(`Failed to get repo structure: ${(err as Error).message}`);
        repoStructure = 'Repository structure unavailable.';
      }
    }

    // Extract OCR text from video events
    const videoContext = this.extractVideoContext(ticket);
    const visualCues = this.extractAllVisualCues(ticket);

    const systemPrompt = this.buildAgentSystemPrompt(ticket, repoStructure, videoContext, visualCues);

    const userPrompt = `A new ticket has been submitted. Please investigate the codebase to find the root cause.

Ticket: "${ticket.title || 'Untitled'}"
${ticket.description ? `Description: ${ticket.description}` : ''}
${ticket.aiSummary ? `AI Summary: ${ticket.aiSummary}` : ''}

Start by identifying which parts of the codebase are likely involved, then read the relevant files to understand the bug. Call update_diagnosis when you have findings.`;

    const loopOptions: AgenticLoopOptions = {
      systemPrompt,
      initialMessage: userPrompt,
      tools: AGENT_TOOLS,
      repoCtx,
      ticket: {
        id: ticket.id,
        tenantId: ticket.tenantId,
        applicationId: ticket.applicationId,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
      },
      tenantId,
      maxIterations: 15,
      maxTokens: 4096,
      timeoutMs: 2 * 60 * 1000,
      ticketId,
    };

    try {
      const result = await this.agenticLoop.run(loopOptions);
      const diagnosis = this.diagnosisService.extractDiagnosisFromToolCalls(result.toolCallLog);

      if (diagnosis) {
        await this.diagnosisService.saveDiagnosis(ticketId, tenantId, diagnosis, result);
        this.logger.log(
          `Deep analysis complete for ticket ${ticketId}: confidence=${diagnosis.confidence}`,
        );
      }

      // Even if no update_diagnosis call was made, save what we have from the final content
      const finalDiagnosis = diagnosis ?? (result.finalContent
        ? {
            rootCause: result.finalContent.substring(0, 500),
            affectedFiles: [],
            confidence: 0.3,
          }
        : null);

      if (finalDiagnosis && !diagnosis) {
        await this.diagnosisService.saveDiagnosis(ticketId, tenantId, finalDiagnosis, result);
      }

      // Mark ticket as analyzed
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'analyzed' },
      });

      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          tenantId,
          eventType: 'analysis_completed',
          data: {
            confidence: finalDiagnosis?.confidence ?? null,
            iterations: result.iterations,
            toolCallCount: result.toolCallLog.length,
          },
        },
      });

      return finalDiagnosis;
    } catch (err) {
      const errorMessage = (err as Error).message;
      this.logger.error(`Deep analysis failed for ticket ${ticketId}: ${errorMessage}`);

      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'analysis_failed' },
      });

      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          tenantId,
          eventType: 'analysis_failed',
          data: { error: errorMessage },
        },
      });

      throw err;
    }
  }

  async handleUserMessage(
    sessionId: string,
    message: string,
    tenantId: string,
    userId: string,
  ): Promise<{
    content: string;
    toolsUsed: string[];
    diagnosis: Diagnosis | null;
  }> {
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, ticket: { tenantId } },
      include: {
        ticket: {
          include: {
            media: {
              select: {
                metadata: true,
                videoEvents: { where: { ocrText: { not: null } }, orderBy: { timestampMs: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const ticket = session.ticket as unknown as TicketWithContext;
    const repoCtx = await this.codeInvestigation.getRepoContext(ticket.applicationId);

    let repoStructure = 'No repository connected to this application.';
    if (repoCtx) {
      try {
        repoStructure = await this.codeInvestigation.getRepoStructure(repoCtx);
      } catch {
        repoStructure = 'Repository structure unavailable.';
      }
    }

    const existingDiagnosis = await this.diagnosisService.getDiagnosis(ticket.id);
    const videoContext = this.extractVideoContext(ticket);
    const visualCues = this.extractAllVisualCues(ticket);
    let systemPrompt = this.buildAgentSystemPrompt(ticket, repoStructure, videoContext, visualCues);

    if (existingDiagnosis) {
      systemPrompt += `\n\n## Current Diagnosis\n${JSON.stringify(existingDiagnosis, null, 2)}`;
    }

    // Rebuild conversation history from persisted messages
    const storedMessages = session.anthropicMessages as AgentMessage[] | null;
    const existingMessages = storedMessages ?? [];

    const loopOptions: AgenticLoopOptions = {
      systemPrompt,
      initialMessage: message,
      tools: AGENT_TOOLS,
      repoCtx,
      ticket: {
        id: ticket.id,
        tenantId: ticket.tenantId,
        applicationId: ticket.applicationId,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
      },
      tenantId,
      maxIterations: 10,
      maxTokens: 4096,
      existingMessages,
      timeoutMs: 30 * 1000,
      ticketId: ticket.id,
      sessionId,
    };

    const result = await this.agenticLoop.run(loopOptions);

    // Save user message
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: message,
        metadata: { userId },
      },
    });

    // Save agent response
    await this.prisma.agentMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: result.finalContent,
        metadata: {
          toolsUsed: result.toolCallLog.map((t) => t.name),
          iterations: result.iterations,
        },
      },
    });

    // Update session with new Anthropic messages
    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        anthropicMessages: result.messages as object,
        toolCallLog: result.toolCallLog as object,
        lastActionAt: new Date(),
      },
    });

    // Update diagnosis if update_diagnosis was called
    const updatedDiagnosis = this.diagnosisService.extractDiagnosisFromToolCalls(
      result.toolCallLog,
    );
    if (updatedDiagnosis) {
      await this.diagnosisService.saveDiagnosis(
        ticket.id,
        tenantId,
        updatedDiagnosis,
        result,
      );
    }

    return {
      content: result.finalContent,
      toolsUsed: result.toolCallLog.map((t) => t.name),
      diagnosis: updatedDiagnosis || existingDiagnosis,
    };
  }

  private async loadTicketWithContext(
    ticketId: string,
    tenantId: string,
  ): Promise<TicketWithContext | null> {
    return this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: {
          select: {
            metadata: true,
            videoEvents: {
              where: { ocrText: { not: null } },
              orderBy: { timestampMs: 'asc' },
            },
          },
        },
      },
    }) as Promise<TicketWithContext | null>;
  }

  private extractVideoContext(ticket: TicketWithContext): string[] {
    return ticket.media
      ?.flatMap((m) =>
        m.videoEvents
          ?.filter((e) => e.ocrText)
          .map((e) => `[${e.timestampMs ?? 0}ms] ${e.ocrText}`) ?? [],
      )
      .filter(Boolean) ?? [];
  }

  private extractAllVisualCues(ticket: TicketWithContext): MediaVisualCues {
    const merged: MediaVisualCues = { errors: [], urls: [], components: [] };

    for (const media of ticket.media ?? []) {
      const cues = media.metadata?.['visualCues'] as MediaVisualCues | undefined;
      if (!cues) continue;
      merged.errors.push(...(cues.errors ?? []));
      merged.urls.push(...(cues.urls ?? []));
      merged.components.push(...(cues.components ?? []));
    }

    return {
      errors: [...new Set(merged.errors)].slice(0, 10),
      urls: [...new Set(merged.urls)].slice(0, 10),
      components: [...new Set(merged.components)].slice(0, 15),
    };
  }

  private buildAgentSystemPrompt(
    ticket: TicketWithContext,
    repoStructure: string,
    videoContext?: string[],
    visualCues?: MediaVisualCues,
  ): string {
    let prompt = `You are an expert software engineer acting as an AI support agent.
You have full access to the codebase through your tools.

## Your Mission
When a bug report or support ticket arrives, your job is to:
1. Understand the issue thoroughly
2. Investigate the codebase to find the root cause
3. Provide a precise, code-level diagnosis
4. Suggest concrete fixes with file paths and line numbers

## Available Context
- Ticket title: ${ticket.title || 'Untitled'}
- Description: ${ticket.description || 'No description'}
- AI Summary: ${ticket.aiSummary || 'Not yet analyzed'}
- Type: ${ticket.type || 'Unknown'}
- Severity: ${ticket.severity || 'Unknown'}
- Keywords: ${ticket.keywords?.join(', ') || 'None'}

## Repository Structure (condensed)
${repoStructure}

## Investigation Strategy
1. Start with get_repo_structure if you need to understand the project layout
2. Use search_codebase_semantic to find code related to the bug description
3. Use search_code for exact text/pattern matching
4. Use read_file to examine specific files in detail
5. Use get_file_history to check recent changes that might have caused the bug
6. Use get_file_blame to identify who last touched relevant code
7. Call update_diagnosis when you have findings

## Fix Strategy (only when confidence >= 0.7)
8. create_branch — name it "fix/ticket-{ticketId}-<short-description>"
9. write_file — write the COMPLETE fixed file content for each changed file
10. create_pull_request — title format: "fix(<scope>): <description>", include root cause and changes in body

## Rules
- Always investigate the code before making claims about root cause
- Never guess about code structure — use your tools to verify
- Keep tool calls efficient — don't read files you don't need
- NEVER write to the default branch — always create a fix branch first
- NEVER provide partial file content in write_file — always the full file
- If confidence < 0.7 → call escalate_to_human instead of attempting a fix
- If the fix spans more than 5 files → call escalate_to_human (too risky for automated fix)`;

    if (videoContext && videoContext.length > 0) {
      prompt += `\n\n## Video Analysis (OCR extracted text)\n${videoContext.join('\n')}\n\nUse these visual cues to search for related code in the repository.`;
    }

    if (visualCues && (visualCues.errors.length > 0 || visualCues.urls.length > 0 || visualCues.components.length > 0)) {
      prompt += '\n\n## Visual Cues Extracted from Video';
      if (visualCues.errors.length > 0) {
        prompt += `\nErrors visible: ${visualCues.errors.join(' | ')}`;
      }
      if (visualCues.urls.length > 0) {
        prompt += `\nURLs/routes visible: ${visualCues.urls.join(', ')}`;
      }
      if (visualCues.components.length > 0) {
        prompt += `\nUI components visible: ${visualCues.components.join(', ')}`;
      }
      prompt += '\n\nUse search_code() with these error messages and component names to find related source files.';
    }

    return prompt;
  }
}

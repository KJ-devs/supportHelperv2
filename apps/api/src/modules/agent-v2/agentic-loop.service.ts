import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolCallResult, ToolName } from './agent-tools';
import { ToolExecutorService, ToolExecutionContext } from './tool-executor.service';
import { ToolCapableProviderFactory } from '../ai-config/tool-capable-provider.factory';
import { AiConfigService } from '../ai-config/ai-config.service';
import {
  AgentMessage,
  AgentTool,
  ContentBlock,
  ToolResultBlock,
} from '../../ai/providers/tool-capable-provider.interface';
import { RepoContext } from './code-investigation.service';
import { encodingForModel } from 'js-tiktoken';

/** Shared encoder instance (cl100k_base covers Claude & GPT-4 models) */
const encoder = encodingForModel('gpt-4o');

/** Read-only tools that are safe to retry on transient failure */
const RETRYABLE_TOOLS: ReadonlySet<string> = new Set([
  'read_file',
  'list_directory',
  'search_code',
  'search_codebase_semantic',
  'get_repo_structure',
  'get_file_history',
  'get_file_blame',
  'get_ticket_details',
  'search_similar_tickets',
]);

/** Count tokens using cl100k_base tokenizer (accurate for Claude & GPT-4 models) */
export function estimateTokens(text: string): number {
  return encoder.encode(text).length;
}

/** Estimate tokens for a full message (string or ContentBlock[]) */
export function estimateMessageTokens(msg: AgentMessage): number {
  if (typeof msg.content === 'string') {
    return estimateTokens(msg.content);
  }
  let total = 0;
  for (const block of msg.content) {
    if (block.type === 'text') {
      total += estimateTokens(block.text);
    } else if (block.type === 'tool_use') {
      total += estimateTokens(block.name) + estimateTokens(JSON.stringify(block.input));
    } else if (block.type === 'tool_result') {
      total += estimateTokens(block.content);
    }
  }
  return total;
}

/** Max chars for a single tool_result content before truncation */
const TOOL_RESULT_MAX_CHARS = 2000;

/** Number of recent messages to always keep intact (sliding window) */
const SLIDING_WINDOW_SIZE = 6;

/**
 * Truncate tool_result blocks that exceed the max character limit.
 * Mutates the message in-place for efficiency.
 */
export function truncateToolResults(msg: AgentMessage): AgentMessage {
  if (typeof msg.content === 'string' || !Array.isArray(msg.content)) return msg;
  const blocks = msg.content.map(block => {
    if (block.type === 'tool_result' && block.content.length > TOOL_RESULT_MAX_CHARS) {
      return {
        ...block,
        content: block.content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n[... truncated]',
      };
    }
    return block;
  });
  return { ...msg, content: blocks };
}

/**
 * Mechanically summarize a message into a short description.
 * No AI call — pure extraction of tool names and short results.
 */
function summarizeMessage(msg: AgentMessage): string {
  if (typeof msg.content === 'string') {
    const preview = msg.content.slice(0, 120);
    return `[${msg.role}] ${preview}${msg.content.length > 120 ? '...' : ''}`;
  }
  const parts: string[] = [];
  for (const block of msg.content) {
    if (block.type === 'text') {
      const preview = block.text.slice(0, 80);
      parts.push(`text: "${preview}${block.text.length > 80 ? '...' : ''}"`);
    } else if (block.type === 'tool_use') {
      parts.push(`called ${block.name}(${Object.keys(block.input).join(', ')})`);
    } else if (block.type === 'tool_result') {
      const ok = block.isError ? 'ERROR' : 'ok';
      const preview = block.content.slice(0, 60);
      parts.push(`result[${ok}]: "${preview}${block.content.length > 60 ? '...' : ''}"`);
    }
  }
  return `[${msg.role}] ${parts.join(' | ')}`;
}

/**
 * Check if a message contains an update_diagnosis tool call (must always be preserved).
 */
function containsUpdateDiagnosis(msg: AgentMessage): boolean {
  if (typeof msg.content === 'string') return false;
  return msg.content.some(block => block.type === 'tool_use' && block.name === 'update_diagnosis');
}

/**
 * Prune messages to fit within a token budget.
 *
 * Strategy:
 * 1. Always keep the first user message (initial prompt)
 * 2. Always keep the last SLIDING_WINDOW_SIZE messages intact
 * 3. Always keep any message containing update_diagnosis
 * 4. Summarize everything else into a single context block
 * 5. Truncate long tool_result blocks
 */
export function pruneMessages(
  messages: AgentMessage[],
  maxTokens: number,
  systemPromptTokens: number
): { pruned: AgentMessage[]; prunedCount: number; tokensSaved: number } {
  // First pass: truncate all tool results
  const truncated = messages.map(truncateToolResults);

  // Check if we're within budget
  const totalTokens =
    systemPromptTokens + truncated.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  if (totalTokens <= maxTokens) {
    return { pruned: truncated, prunedCount: 0, tokensSaved: 0 };
  }

  // Identify protected messages
  const firstMsg = truncated[0]; // initial user message — always keep
  const recentStart = Math.max(1, truncated.length - SLIDING_WINDOW_SIZE);
  const recentMessages = truncated.slice(recentStart);

  // Middle messages: candidates for pruning
  const middleMessages = truncated.slice(1, recentStart);

  // Separate protected (update_diagnosis) from pruneable
  const protectedMiddle: AgentMessage[] = [];
  const pruneableMiddle: AgentMessage[] = [];
  for (const msg of middleMessages) {
    if (containsUpdateDiagnosis(msg)) {
      protectedMiddle.push(msg);
    } else {
      pruneableMiddle.push(msg);
    }
  }

  // Summarize pruneable messages into a single context block
  const tokensBefore = pruneableMiddle.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  let summaryBlock: AgentMessage | null = null;
  if (pruneableMiddle.length > 0) {
    const summaryLines = pruneableMiddle.map(summarizeMessage);
    const summaryText = `[Context summary of ${pruneableMiddle.length} earlier messages]\n${summaryLines.join('\n')}`;
    summaryBlock = { role: 'user', content: summaryText };
  }

  // Rebuild: first message + summary + protected middle + recent
  const pruned: AgentMessage[] = [firstMsg];
  if (summaryBlock) pruned.push(summaryBlock);
  pruned.push(...protectedMiddle);
  pruned.push(...recentMessages);

  const tokensAfter = pruned.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const tokensSaved = tokensBefore - (summaryBlock ? estimateMessageTokens(summaryBlock) : 0);

  return {
    pruned,
    prunedCount: pruneableMiddle.length,
    tokensSaved: Math.max(0, tokensSaved),
  };
}

export interface AgenticLoopOptions {
  systemPrompt: string;
  initialMessage: string;
  tools: AgentTool[];
  repoCtx: RepoContext | null;
  ticket: ToolExecutionContext['ticket'];
  tenantId: string;
  maxIterations?: number;
  maxTokens?: number;
  existingMessages?: AgentMessage[];
  timeoutMs?: number;
  ticketId?: string;
  sessionId?: string;
  /** Max context tokens before pruning triggers (default: 50000) */
  maxContextTokens?: number;
  /** Skip guided-mode checkpoints (used when resuming after approval) */
  skipCheckpoints?: boolean;
  /** AgentTask ID to write execution log entries into (optional — loop is also used without a task) */
  agentTaskId?: string;
}

export interface AgenticLoopResult {
  finalContent: string;
  toolCallLog: ToolCallResult[];
  iterations: number;
  messages: AgentMessage[];
}

@Injectable()
export class AgenticLoopService {
  private readonly logger = new Logger(AgenticLoopService.name);
  private readonly DEFAULT_MAX_ITERATIONS = 15;
  private readonly DEFAULT_MAX_TOKENS = 4096;
  private readonly DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  private readonly DEFAULT_MAX_CONTEXT_TOKENS = 50_000;

  constructor(
    private readonly toolExecutor: ToolExecutorService,
    private readonly providerFactory: ToolCapableProviderFactory,
    private readonly aiConfigService: AiConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService
  ) {}

  private stepToEmoji(step: string, hasError?: boolean): string {
    if (hasError) return '❌';
    switch (step) {
      case 'analysis_started':
        return '🚀';
      case 'thinking':
        return '🧠';
      case 'conclusion':
        return '📋';
      case 'read_file':
        return '📖';
      case 'list_directory':
        return '📂';
      case 'get_repo_structure':
        return '🗂️';
      case 'search_code':
        return '🔍';
      case 'search_codebase_semantic':
        return '🔮';
      case 'get_file_history':
        return '📜';
      case 'get_file_blame':
        return '🔎';
      case 'get_ticket_details':
        return '🎫';
      case 'search_similar_tickets':
        return '🔗';
      case 'update_diagnosis':
        return '🩺';
      case 'write_file':
        return '✏️';
      case 'edit_file':
        return '🛠️';
      case 'create_branch':
        return '🌿';
      case 'create_pull_request':
        return '🚀';
      case 'model_upgrade':
        return '⚡';
      case 'analysis_completed':
        return '✅';
      case 'status_changed':
        return '🔄';
      default:
        return '▶️';
    }
  }

  private stepToPhase(step: string): string {
    switch (step) {
      case 'analysis_started':
      case 'thinking':
      case 'read_file':
      case 'list_directory':
      case 'get_repo_structure':
      case 'get_file_history':
      case 'get_file_blame':
      case 'get_ticket_details':
      case 'search_similar_tickets':
      case 'search_code':
      case 'search_codebase_semantic':
        return 'analysis';
      case 'update_diagnosis':
      case 'conclusion':
        return 'plan';
      case 'write_file':
      case 'edit_file':
      case 'create_branch':
        return 'codegen';
      case 'create_pull_request':
        return 'pushpr';
      default:
        return 'system';
    }
  }

  private emitLogEntry(
    agentTaskId: string,
    entry: {
      step: string;
      message: string;
      durationMs?: number;
      hasError?: boolean;
      detail?: string;
      toolInput?: Record<string, unknown>;
      resultPreview?: string;
    }
  ): void {
    const enrichedEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      emoji: this.stepToEmoji(entry.step, entry.hasError),
      phase: this.stepToPhase(entry.step),
    };
    this.prisma.agentTask
      .findUnique({ where: { id: agentTaskId }, select: { executionLog: true, tenantId: true } })
      .then(task => {
        if (!task) return;
        const currentLog = (task.executionLog as object[]) || [];
        return this.prisma.agentTask
          .update({
            where: { id: agentTaskId },
            data: { executionLog: [...currentLog, enrichedEntry] as object[] },
          })
          .then(() => {
            this.eventEmitter.emit('agent-task:log-appended', {
              taskId: agentTaskId,
              tenantId: task.tenantId,
              entry: enrichedEntry,
            });
          });
      })
      .catch(err => this.logger.warn(`Failed to append execution log: ${(err as Error).message}`));
  }

  /** Shorten a file path to the last 3 segments for display. */
  private shortenPath(p: string): string {
    if (!p) return p;
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length > 3 ? parts.slice(-3).join('/') : p;
  }

  private summarizeToolCall(
    toolName: string,
    input: Record<string, unknown>,
    error?: string
  ): string {
    if (error) return `❌ ${toolName} failed — ${error}`;
    const rawPath =
      (input['file_path'] as string | undefined) || (input['path'] as string | undefined);
    const filePath = rawPath ? this.shortenPath(rawPath) : undefined;
    switch (toolName) {
      case 'read_file':
        return `Reading ${filePath || 'file'}`;
      case 'search_code':
        return `Searching codebase for "${(input['query'] as string | undefined) || (input['pattern'] as string | undefined) || ''}"`;
      case 'search_codebase_semantic':
        return `Searching codebase for "${(input['query'] as string | undefined) || ''}"`;
      case 'list_directory':
        return `Exploring ${filePath || 'directory'}`;
      case 'get_repo_structure':
        return 'Mapping repository structure';
      case 'get_file_history':
        return `Tracing history of ${filePath || 'file'}`;
      case 'get_file_blame':
        return `Inspecting blame for ${filePath || 'file'}`;
      case 'update_diagnosis': {
        const conf = input['confidence'] as number | string | undefined;
        const pct =
          conf !== undefined ? Math.round(Number(conf) * (Number(conf) <= 1 ? 100 : 1)) : null;
        return `Diagnosis updated${pct !== null ? ` — confidence ${pct}%` : ''}`;
      }
      case 'create_branch':
        return `Creating branch ${(input['branch_name'] as string | undefined) || ''}`;
      case 'write_file':
        return `Writing ${filePath || 'file'}`;
      case 'edit_file':
        return `Patching ${filePath || 'file'}`;
      case 'create_pull_request':
        return `Opening PR "${(input['title'] as string | undefined) || ''}"`;
      case 'list_repos':
        return 'Listing connected repositories';
      default:
        return `${toolName} executed`;
    }
  }

  private buildResultPreview(toolName: string, result: unknown): string | undefined {
    if (!result) return undefined;
    const str = typeof result === 'string' ? result : JSON.stringify(result);
    switch (toolName) {
      case 'read_file': {
        const lines = str.split('\n').length;
        return `${lines} lines`;
      }
      case 'search_code':
      case 'search_codebase_semantic': {
        const matches = (str.match(/\n/g) || []).length;
        return matches > 0 ? `${matches} results` : 'No results';
      }
      case 'list_directory': {
        try {
          const items = JSON.parse(str) as unknown;
          return Array.isArray(items) ? `${(items as unknown[]).length} items` : undefined;
        } catch {
          const items = str.split('\n').filter(Boolean).length;
          return `${items} items`;
        }
      }
      case 'update_diagnosis': {
        try {
          const diag =
            typeof result === 'object'
              ? (result as Record<string, unknown>)
              : (JSON.parse(str) as Record<string, unknown>);
          const raw = diag['confidence'] as number | string | undefined;
          if (raw === undefined) return undefined;
          const pct = Math.round(Number(raw) * (Number(raw) <= 1 ? 100 : 1));
          return `confidence: ${pct}%`;
        } catch {
          return undefined;
        }
      }
      case 'create_pull_request': {
        try {
          const pr = result as Record<string, unknown>;
          if (pr['error']) return `error: ${String(pr['error'])}`;
          const reused = pr['reused'] ? ' (existing PR updated)' : '';
          return `PR #${(pr['number'] as number | undefined) ?? '?'} → ${(pr['url'] as string | undefined) || ''}${reused}`;
        } catch {
          return undefined;
        }
      }
      default:
        return str.length > 100 ? `${str.length} chars` : undefined;
    }
  }

  private sanitizeToolInput(
    toolName: string,
    input: Record<string, unknown>
  ): Record<string, unknown> {
    void toolName;
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (['content', 'old_text', 'new_text', 'body'].includes(k)) {
        safe[k] = `[${typeof v === 'string' ? v.length : '?'} chars]`;
      } else {
        safe[k] = v;
      }
    }
    return safe;
  }

  private selectModel(
    toolsUsed: string[],
    iterationCount: number
  ): { model: string; level: 'N1' | 'N2' } {
    const N2_TOOLS = [
      'edit_file',
      'write_file',
      'create_pull_request',
      'create_branch',
      'get_file_blame',
      'get_file_history',
    ];
    const isN2 = iterationCount > 8 || toolsUsed.some(t => N2_TOOLS.includes(t));
    return isN2
      ? { model: 'claude-sonnet-4-6', level: 'N2' }
      : { model: 'claude-haiku-4-5-20251001', level: 'N1' };
  }

  private emitActivity(
    sessionId: string,
    currentAction: string,
    agentLevel: 'N1' | 'N2',
    model: string,
    toolName?: string,
    iteration?: number
  ) {
    this.eventEmitter.emit('agent.activity', {
      sessionId,
      agentLevel,
      model,
      currentAction,
      toolName,
      iteration: iteration ?? 0,
      timestamp: new Date(),
    });
  }

  private toolToAction(toolName: string, input: Record<string, unknown>): string {
    switch (toolName) {
      case 'read_file':
        return `Reading file ${(input['path'] as string | undefined) ?? ''}`;
      case 'search_code':
        return 'Searching codebase...';
      case 'search_codebase_semantic':
        return 'Searching codebase...';
      case 'list_directory':
        return 'Exploring directory...';
      case 'search_similar_tickets':
        return 'Searching similar tickets...';
      case 'update_diagnosis':
        return 'Updating diagnosis...';
      case 'edit_file':
      case 'write_file':
        return 'Writing code...';
      case 'create_pull_request':
        return 'Creating pull request...';
      default:
        return 'Processing...';
    }
  }

  async run(options: AgenticLoopOptions): Promise<AgenticLoopResult> {
    const {
      systemPrompt,
      initialMessage,
      tools,
      repoCtx,
      ticket,
      tenantId,
      maxIterations = this.DEFAULT_MAX_ITERATIONS,
      maxTokens = this.DEFAULT_MAX_TOKENS,
      existingMessages = [],
      timeoutMs = this.DEFAULT_TIMEOUT_MS,
      ticketId,
      sessionId,
      maxContextTokens = this.DEFAULT_MAX_CONTEXT_TOKENS,
      skipCheckpoints = false,
      agentTaskId,
    } = options;

    const [provider, config] = await Promise.all([
      this.providerFactory.createForTenant(tenantId),
      this.aiConfigService.getFullConfig(tenantId),
    ]);
    const model = config?.model ?? 'claude-sonnet-4-6';

    const executionContext: ToolExecutionContext = {
      repoCtx,
      ticket,
      tenantId,
      applicationId: ticket.applicationId,
    };

    const messages: AgentMessage[] = [
      ...existingMessages,
      { role: 'user', content: initialMessage },
    ];

    const toolCallLog: ToolCallResult[] = [];
    let iterations = 0;
    let finalContent = '';
    const deadline = Date.now() + timeoutMs;
    const systemPromptTokens = estimateTokens(systemPrompt);
    const allToolsUsed: string[] = [];
    let currentLevel: 'N1' | 'N2' = 'N1';
    let currentModel = 'claude-haiku-4-5-20251001';
    let checkpointHit = false;

    // Emit start activity
    if (sessionId) {
      this.emitActivity(
        sessionId,
        'Analyzing ticket description...',
        currentLevel,
        currentModel,
        undefined,
        0
      );
    }

    if (agentTaskId) {
      this.emitLogEntry(agentTaskId, {
        step: 'analysis_started',
        message: 'V2 agentic analysis started',
      });
    }

    while (!checkpointHit && iterations < maxIterations) {
      if (Date.now() > deadline) {
        this.logger.warn(`Agentic loop timed out after ${iterations} iterations`);
        break;
      }

      iterations++;

      // Determine model/level based on tools used so far and iteration count
      const { model: selectedModel, level: selectedLevel } = this.selectModel(
        allToolsUsed,
        iterations
      );
      if (selectedLevel !== currentLevel) {
        const prevLevel = currentLevel;
        currentLevel = selectedLevel;
        currentModel = selectedModel;
        // Persist level/model to DB if we have a sessionId
        if (sessionId) {
          try {
            await this.prisma.agentSession.updateMany({
              where: { id: sessionId },
              data: { agentLevel: currentLevel, modelUsed: currentModel },
            });
          } catch {
            // Non-blocking — best effort persistence
          }
          this.eventEmitter.emit('agent.level_changed', {
            sessionId,
            level: currentLevel,
            model: currentModel,
            reason:
              iterations > 8
                ? 'Extended investigation required'
                : 'Deep code investigation required',
          });
        }
        this.logger.log(
          `Agent level upgraded: ${prevLevel} → ${currentLevel} (model: ${currentModel}) at iteration ${iterations}`
        );
        if (agentTaskId) {
          this.emitLogEntry(agentTaskId, {
            step: 'model_upgrade',
            message: `Agent upgraded: ${prevLevel} → ${currentLevel} (${currentModel})`,
          });
        }
      } else {
        currentModel = selectedModel;
        currentLevel = selectedLevel;
      }

      // Context pruning: trim messages if they exceed the token budget
      const { pruned, prunedCount, tokensSaved } = pruneMessages(
        messages,
        maxContextTokens,
        systemPromptTokens
      );
      if (prunedCount > 0) {
        this.logger.log(
          `Context pruning: removed ${prunedCount} messages, saved ~${tokensSaved} tokens (iteration ${iterations})`
        );
        messages.length = 0;
        messages.push(...pruned);
      }

      this.eventEmitter.emit('agent:thinking', {
        ticketId,
        sessionId,
        iteration: iterations,
        agentLevel: currentLevel,
        model: currentModel,
      });

      let turn: Awaited<ReturnType<typeof provider.chat>>;
      try {
        turn = await provider.chat({
          model,
          maxTokens,
          systemPrompt,
          messages,
          tools,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown provider error';
        this.logger.error(
          `provider.chat() failed on iteration ${iterations}: ${errorMsg}`,
          err instanceof Error ? err.stack : undefined
        );
        finalContent = `Analysis interrupted: AI provider error — ${errorMsg}`;
        break;
      }

      // Append the assistant message to history
      messages.push(turn.assistantMessage);

      // Log AI reasoning if present
      if (agentTaskId && turn.textBlocks.length > 0) {
        const reasoning = turn.textBlocks.map(b => b.text).join('\n');
        if (reasoning.trim()) {
          this.emitLogEntry(agentTaskId, {
            step: 'thinking',
            message: reasoning.length > 200 ? reasoning.slice(0, 200) + '...' : reasoning,
            detail: reasoning.length > 200 ? reasoning : undefined,
          });
        }
      }

      // If no tool calls, we have the final response
      if (turn.toolUseBlocks.length === 0 || turn.stopReason === 'end_turn') {
        finalContent = turn.textBlocks.map(b => b.text).join('\n');
        if (agentTaskId && finalContent.trim()) {
          this.emitLogEntry(agentTaskId, {
            step: 'conclusion',
            message: finalContent.length > 200 ? finalContent.slice(0, 200) + '...' : finalContent,
            detail: finalContent.length > 200 ? finalContent : undefined,
          });
        }
        break;
      }

      // Execute each tool call and collect results
      const toolResultBlocks: Array<{
        type: 'tool_result';
        toolUseId: string;
        content: string;
        isError?: boolean;
      }> = [];

      for (const toolUse of turn.toolUseBlocks) {
        const startTime = Date.now();
        let result: unknown;
        let error: string | undefined;

        allToolsUsed.push(toolUse.name);

        // Guided mode: intercept create_pull_request before execution
        if (!skipCheckpoints && sessionId && toolUse.name === 'create_pull_request') {
          const guidedSession = await this.prisma.agentSession.findUnique({
            where: { id: sessionId },
            select: { agentMode: true, checkpointState: true },
          });

          if (guidedSession?.agentMode === 'guided') {
            await this.prisma.agentSession.update({
              where: { id: sessionId },
              data: { checkpointState: 'waiting_pr_approval' },
            });

            const toolInput = toolUse.input as Record<string, unknown>;
            const proposedChanges = (toolInput['files'] as string[] | undefined) ?? [];

            this.eventEmitter.emit('agent.checkpoint', {
              sessionId,
              checkpointType: 'pr_ready',
              summary:
                'Investigation complete. The agent has identified the fix and is ready to create a pull request.',
              proposedChanges,
              message: 'Ready to create a pull request. Awaiting developer approval.',
            });

            this.logger.log(`Guided mode: paused at PR checkpoint for session ${sessionId}`);

            finalContent = 'Guided mode: ready to create a pull request. Awaiting your approval.';
            checkpointHit = true;
            break;
          }
        }

        if (checkpointHit) break;

        this.eventEmitter.emit('agent:tool_call', {
          ticketId,
          sessionId,
          toolName: toolUse.name,
          input: toolUse.input,
          agentLevel: currentLevel,
          model: currentModel,
        });

        if (sessionId) {
          const action = this.toolToAction(toolUse.name, toolUse.input as Record<string, unknown>);
          this.emitActivity(
            sessionId,
            action,
            currentLevel,
            currentModel,
            toolUse.name,
            iterations
          );
        }

        try {
          result = await this.toolExecutor.execute(
            toolUse.name as ToolName,
            toolUse.input,
            executionContext
          );
        } catch (err) {
          // Retry once for read-only tools on transient failure
          if (RETRYABLE_TOOLS.has(toolUse.name)) {
            this.logger.warn(
              `Tool "${toolUse.name}" failed, retrying in 1s: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
            await new Promise(r => setTimeout(r, 1000));
            try {
              result = await this.toolExecutor.execute(
                toolUse.name as ToolName,
                toolUse.input,
                executionContext
              );
            } catch (retryErr) {
              error = retryErr instanceof Error ? retryErr.message : 'Unknown error';
              result = { error };
            }
          } else {
            error = err instanceof Error ? err.message : 'Unknown error';
            result = { error };
          }
        }

        const durationMs = Date.now() - startTime;

        // ToolExecutorService catches all errors internally and returns { error: "..." }.
        // Promote those object-level errors so hasError is set correctly.
        if (
          !error &&
          result !== null &&
          typeof result === 'object' &&
          'error' in (result as Record<string, unknown>)
        ) {
          const resultError = (result as Record<string, unknown>)['error'];
          error = typeof resultError === 'string' ? resultError : JSON.stringify(resultError);
          if (toolUse.name === 'create_pull_request') {
            this.logger.error(
              `create_pull_request failed for ticket ${executionContext.ticket.id}: ${error}`
            );
          }
        }

        this.eventEmitter.emit('agent:tool_result', {
          ticketId,
          sessionId,
          toolName: toolUse.name,
          durationMs,
          hasError: !!error,
        });

        toolCallLog.push({
          toolCallId: toolUse.id,
          name: toolUse.name as ToolName,
          input: toolUse.input,
          result,
          error,
          durationMs,
        });

        if (agentTaskId) {
          const resultPreview = !error ? this.buildResultPreview(toolUse.name, result) : undefined;
          this.emitLogEntry(agentTaskId, {
            step: toolUse.name,
            message: this.summarizeToolCall(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              error
            ),
            durationMs,
            hasError: !!error,
            detail: error && toolUse.name === 'create_pull_request' ? error : undefined,
            resultPreview,
            toolInput: this.sanitizeToolInput(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            ),
          });
        }

        toolResultBlocks.push({
          type: 'tool_result',
          toolUseId: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError: !!error,
        });
      }

      // Add tool results back to the conversation
      messages.push({ role: 'user', content: toolResultBlocks });

      // Guided mode: after update_diagnosis, pause for analysis approval (first time only)
      if (!skipCheckpoints && sessionId) {
        const hasUpdateDiagnosis = turn.toolUseBlocks.some(t => t.name === 'update_diagnosis');
        if (hasUpdateDiagnosis) {
          const guidedSession = await this.prisma.agentSession.findUnique({
            where: { id: sessionId },
            select: { agentMode: true, checkpointState: true },
          });

          if (guidedSession?.agentMode === 'guided' && guidedSession.checkpointState === 'none') {
            await this.prisma.agentSession.update({
              where: { id: sessionId },
              data: { checkpointState: 'waiting_analysis_approval' },
            });

            // Extract diagnosis summary from the tool call input
            const diagCall = turn.toolUseBlocks.find(t => t.name === 'update_diagnosis');
            const diagInput = diagCall?.input as Record<string, unknown> | undefined;
            const diagnosisSummary =
              (diagInput?.['rootCause'] as string | undefined) ??
              (diagInput?.['summary'] as string | undefined) ??
              'Analysis complete';

            this.eventEmitter.emit('agent.checkpoint', {
              sessionId,
              checkpointType: 'analysis_complete',
              summary: diagnosisSummary,
              proposedNextSteps: [
                'Deep code investigation',
                'Search for similar tickets',
                'Propose a fix',
              ],
              message:
                'Analysis complete. Awaiting developer approval to proceed with investigation.',
            });

            this.logger.log(`Guided mode: paused at analysis checkpoint for session ${sessionId}`);

            finalContent =
              'Guided mode: initial analysis complete. Awaiting your approval to proceed with deep investigation.';
            checkpointHit = true;
            break;
          }
        }
      }
    }

    this.logger.log(
      `Agentic loop completed: ${iterations} iterations, ${toolCallLog.length} tool calls`
    );

    if (sessionId) {
      this.emitActivity(
        sessionId,
        'Analysis complete',
        currentLevel,
        currentModel,
        undefined,
        iterations
      );
    }

    this.eventEmitter.emit('agent:complete', { ticketId, sessionId, finalContent });

    if (agentTaskId) {
      this.emitLogEntry(agentTaskId, {
        step: 'analysis_completed',
        message: `Analysis completed: ${iterations} iterations, ${toolCallLog.length} tool calls`,
      });
    }

    return { finalContent, toolCallLog, iterations, messages };
  }
}

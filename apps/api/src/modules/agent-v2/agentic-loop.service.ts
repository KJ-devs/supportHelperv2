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

    while (iterations < maxIterations) {
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
      if (selectedLevel !== currentLevel && sessionId) {
        const prevLevel = currentLevel;
        currentLevel = selectedLevel;
        currentModel = selectedModel;
        // Persist level/model to DB if we have a sessionId
        try {
          await this.prisma.agentSession.updateMany({
            where: { id: sessionId },
            data: { agentLevel: currentLevel, modelUsed: currentModel },
          });
        } catch {
          // Non-blocking — best effort persistence
        }
        this.logger.log(
          `Agent level upgraded: ${prevLevel} → ${currentLevel} (model: ${currentModel}) at iteration ${iterations}`
        );
        this.eventEmitter.emit('agent.level_changed', {
          sessionId,
          level: currentLevel,
          model: currentModel,
          reason:
            iterations > 8 ? 'Extended investigation required' : 'Deep code investigation required',
        });
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

      // If no tool calls, we have the final response
      if (turn.toolUseBlocks.length === 0 || turn.stopReason === 'end_turn') {
        finalContent = turn.textBlocks.map(b => b.text).join('\n');
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

        toolResultBlocks.push({
          type: 'tool_result',
          toolUseId: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError: !!error,
        });
      }

      // Add tool results back to the conversation
      messages.push({ role: 'user', content: toolResultBlocks });
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

    return { finalContent, toolCallLog, iterations, messages };
  }
}

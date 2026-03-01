import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

/** Approximate token count: 1 token ≈ 4 characters */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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
  const blocks = msg.content.map((block) => {
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
  return msg.content.some(
    (block) => block.type === 'tool_use' && block.name === 'update_diagnosis',
  );
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
  systemPromptTokens: number,
): { pruned: AgentMessage[]; prunedCount: number; tokensSaved: number } {
  // First pass: truncate all tool results
  const truncated = messages.map(truncateToolResults);

  // Check if we're within budget
  const totalTokens = systemPromptTokens + truncated.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
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
  ) {}

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

    while (iterations < maxIterations) {
      if (Date.now() > deadline) {
        this.logger.warn(`Agentic loop timed out after ${iterations} iterations`);
        break;
      }

      iterations++;

      // Context pruning: trim messages if they exceed the token budget
      const { pruned, prunedCount, tokensSaved } = pruneMessages(
        messages,
        maxContextTokens,
        systemPromptTokens,
      );
      if (prunedCount > 0) {
        this.logger.log(
          `Context pruning: removed ${prunedCount} messages, saved ~${tokensSaved} tokens (iteration ${iterations})`,
        );
        messages.length = 0;
        messages.push(...pruned);
      }

      this.eventEmitter.emit('agent:thinking', { ticketId, sessionId, iteration: iterations });

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
          err instanceof Error ? err.stack : undefined,
        );
        finalContent = `Analysis interrupted: AI provider error — ${errorMsg}`;
        break;
      }

      // Append the assistant message to history
      messages.push(turn.assistantMessage);

      // If no tool calls, we have the final response
      if (turn.toolUseBlocks.length === 0 || turn.stopReason === 'end_turn') {
        finalContent = turn.textBlocks.map((b) => b.text).join('\n');
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

        this.eventEmitter.emit('agent:tool_call', {
          ticketId,
          sessionId,
          toolName: toolUse.name,
          input: toolUse.input,
        });

        try {
          result = await this.toolExecutor.execute(
            toolUse.name as ToolName,
            toolUse.input,
            executionContext,
          );
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
          result = { error };
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
      `Agentic loop completed: ${iterations} iterations, ${toolCallLog.length} tool calls`,
    );

    this.eventEmitter.emit('agent:complete', { ticketId, sessionId, finalContent });

    return { finalContent, toolCallLog, iterations, messages };
  }
}

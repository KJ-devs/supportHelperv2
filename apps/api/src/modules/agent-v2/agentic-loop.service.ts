import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ToolCallResult, ToolName } from './agent-tools';
import { ToolExecutorService, ToolExecutionContext } from './tool-executor.service';
import { ToolCapableProviderFactory } from '../ai-config/tool-capable-provider.factory';
import { AiConfigService } from '../ai-config/ai-config.service';
import { AgentMessage, AgentTool } from '../../ai/providers/tool-capable-provider.interface';
import { RepoContext } from './code-investigation.service';

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

    while (iterations < maxIterations) {
      if (Date.now() > deadline) {
        this.logger.warn(`Agentic loop timed out after ${iterations} iterations`);
        break;
      }

      iterations++;

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

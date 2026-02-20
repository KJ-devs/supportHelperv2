import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AGENT_TOOLS, ToolCallResult, ToolName } from './agent-tools';
import { ToolExecutorService, ToolExecutionContext } from './tool-executor.service';
import { AnthropicClientFactory } from '../ai-config/anthropic-client.factory';
import { RepoContext } from './code-investigation.service';

export interface AgenticLoopOptions {
  systemPrompt: string;
  initialMessage: string;
  tools: Anthropic.Tool[];
  repoCtx: RepoContext | null;
  ticket: ToolExecutionContext['ticket'];
  tenantId: string;
  maxIterations?: number;
  maxTokens?: number;
  existingMessages?: Anthropic.MessageParam[];
  timeoutMs?: number;
  ticketId?: string;
  sessionId?: string;
}

export interface AgenticLoopResult {
  finalContent: string;
  toolCallLog: ToolCallResult[];
  iterations: number;
  messages: Anthropic.MessageParam[];
}

@Injectable()
export class AgenticLoopService {
  private readonly logger = new Logger(AgenticLoopService.name);
  private readonly DEFAULT_MODEL = 'claude-sonnet-4-20250514';
  private readonly DEFAULT_MAX_ITERATIONS = 15;
  private readonly DEFAULT_MAX_TOKENS = 4096;
  private readonly DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

  constructor(
    private readonly toolExecutor: ToolExecutorService,
    private readonly anthropicFactory: AnthropicClientFactory,
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

    const client = await this.anthropicFactory.createForTenant(tenantId);

    if (!client) {
      throw new ServiceUnavailableException(
        'No Anthropic API key configured for this tenant. Set up an AI provider in Settings.',
      );
    }

    const executionContext: ToolExecutionContext = {
      repoCtx,
      ticket,
      tenantId,
      applicationId: ticket.applicationId,
    };

    const messages: Anthropic.MessageParam[] = [
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

      const response = await client.messages.create({
        model: this.DEFAULT_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );

      // Append the assistant message to history
      messages.push({ role: 'assistant', content: response.content });

      // If no tool calls, we have the final response
      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        finalContent = textBlocks.map((b) => b.text).join('\n');
        break;
      }

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
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
            toolUse.input as Record<string, unknown>,
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

        const callRecord: ToolCallResult = {
          toolCallId: toolUse.id,
          name: toolUse.name as ToolName,
          input: toolUse.input as Record<string, unknown>,
          result,
          error,
          durationMs,
        };

        toolCallLog.push(callRecord);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content:
            typeof result === 'string' ? result : JSON.stringify(result),
          is_error: !!error,
        });
      }

      // Add tool results back to the conversation
      messages.push({ role: 'user', content: toolResults });
    }

    this.logger.log(
      `Agentic loop completed: ${iterations} iterations, ${toolCallLog.length} tool calls`,
    );

    this.eventEmitter.emit('agent:complete', { ticketId, sessionId, finalContent });

    return { finalContent, toolCallLog, iterations, messages };
  }
}

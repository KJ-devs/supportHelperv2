import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  AgentTool,
  AgentMessage,
  AgentTurnResult,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ContentBlock,
} from './tool-capable-provider.interface';

export class ToolFormatConverter {
  // ─── Anthropic ──────────────────────────────────────────────────────────────

  static toAnthropicTools(tools: AgentTool[]): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }

  static toAnthropicMessages(messages: AgentMessage[]): Anthropic.MessageParam[] {
    return messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content } as Anthropic.MessageParam;
      }

      const content: Anthropic.ContentBlockParam[] = m.content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text } as Anthropic.TextBlockParam;
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          } as Anthropic.ToolUseBlockParam;
        }
        const tr = block as ToolResultBlock;
        return {
          type: 'tool_result',
          tool_use_id: tr.toolUseId,
          content: tr.content,
          is_error: tr.isError,
        } as Anthropic.ToolResultBlockParam;
      });

      return { role: m.role, content } as Anthropic.MessageParam;
    });
  }

  static fromAnthropicResponse(response: Anthropic.Message): AgentTurnResult {
    const textBlocks: TextBlock[] = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => ({ type: 'text', text: b.text }));

    const toolUseBlocks: ToolUseBlock[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({
        type: 'tool_use',
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      }));

    const assistantContent: ContentBlock[] = [...textBlocks, ...toolUseBlocks];

    return {
      textBlocks,
      toolUseBlocks,
      stopReason: response.stop_reason ?? 'end_turn',
      assistantMessage: { role: 'assistant', content: assistantContent },
    };
  }

  // ─── OpenAI ─────────────────────────────────────────────────────────────────

  static toOpenAITools(tools: AgentTool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  /**
   * Convert canonical AgentMessage[] to OpenAI message params.
   * Key difference from Anthropic: tool results must be separate messages
   * with role='tool', one per result. Anthropic groups them in a single user
   * message; here we "explode" them.
   */
  static toOpenAIMessages(
    messages: AgentMessage[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const m of messages) {
      if (typeof m.content === 'string') {
        result.push({ role: m.role as 'user' | 'assistant', content: m.content });
        continue;
      }

      if (m.role === 'user') {
        const toolResultBlocks = m.content.filter(
          (b): b is ToolResultBlock => b.type === 'tool_result',
        );
        const textBlocks = m.content.filter(
          (b): b is TextBlock => b.type === 'text',
        );

        // Explode each tool result into its own message
        for (const tr of toolResultBlocks) {
          result.push({
            role: 'tool',
            tool_call_id: tr.toolUseId,
            content: tr.content,
          });
        }

        const textContent = textBlocks.map((b) => b.text).join('\n');
        if (textContent) {
          result.push({ role: 'user', content: textContent });
        }
      } else {
        // assistant
        const textBlocks = m.content.filter((b): b is TextBlock => b.type === 'text');
        const toolUseBlocks = m.content.filter(
          (b): b is ToolUseBlock => b.type === 'tool_use',
        );

        const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = toolUseBlocks.map(
          (b) => ({
            id: b.id,
            type: 'function' as const,
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input),
            },
          }),
        );

        const textContent = textBlocks.map((b) => b.text).join('\n') || null;

        result.push({
          role: 'assistant',
          content: textContent,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      }
    }

    return result;
  }

  static fromOpenAIResponse(
    response: OpenAI.Chat.ChatCompletion,
  ): AgentTurnResult {
    const message = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    const textBlocks: TextBlock[] = message.content
      ? [{ type: 'text', text: message.content }]
      : [];

    const toolUseBlocks: ToolUseBlock[] = (message.tool_calls ?? []).map((tc) => ({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const assistantContent: ContentBlock[] = [...textBlocks, ...toolUseBlocks];
    const stopReason =
      finishReason === 'tool_calls' ? 'tool_use' : (finishReason ?? 'end_turn');

    return {
      textBlocks,
      toolUseBlocks,
      stopReason,
      assistantMessage: { role: 'assistant', content: assistantContent },
    };
  }
}

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
  Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime';
import OpenAI from 'openai';
import { AIProvider, CompletionOptions } from './ai-provider.interface';
import {
  AgentTool,
  AgentMessage,
  AgentTurnResult,
  TextBlock,
  ToolUseBlock,
  ContentBlock,
  ToolResultBlock,
} from './tool-capable-provider.interface';
import { ToolCapableProvider } from './tool-capable-provider.interface';
import { withRetry } from './ai-retry.util';

const BEDROCK_SONNET_MODEL = 'anthropic.claude-sonnet-4-6-v1:0';
const BEDROCK_HAIKU_MODEL = 'anthropic.claude-haiku-4-5-20251001-v1:0';
const EMBEDDING_MAX_CHARS = 32000;

export interface BedrockProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  model?: string;
  openaiApiKey?: string;
}

@Injectable()
export class BedrockProvider implements AIProvider, ToolCapableProvider {
  private readonly logger = new Logger(BedrockProvider.name);
  private readonly client: BedrockRuntimeClient;
  private readonly model: string;
  private readonly openaiClient: OpenAI | null;

  constructor(config: BedrockProviderConfig) {
    this.model = config.model ?? BEDROCK_SONNET_MODEL;

    const clientConfig: ConstructorParameters<typeof BedrockRuntimeClient>[0] = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.client = new BedrockRuntimeClient(clientConfig);

    this.openaiClient = config.openaiApiKey
      ? new OpenAI({ apiKey: config.openaiApiKey })
      : null;
  }

  // ─── AIProvider ─────────────────────────────────────────────────────────────

  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
  ): Promise<string> {
    const model = options?.model ?? this.model;

    try {
      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.7,
        ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
        messages: [{ role: 'user', content: prompt }],
      });

      const response = await withRetry(
        () =>
          this.client.send(
            new InvokeModelCommand({
              modelId: model,
              contentType: 'application/json',
              accept: 'application/json',
              body: Buffer.from(body),
            }),
          ),
        { label: 'Bedrock.generateCompletion' },
      );

      const parsed = JSON.parse(Buffer.from(response.body).toString('utf-8')) as {
        content: Array<{ type: string; text?: string }>;
      };

      const textContent = parsed.content.find((b) => b.type === 'text');
      return textContent?.text ?? '';
    } catch (error) {
      this.logger.error(
        `Bedrock generateCompletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: Record<string, unknown>,
    options?: CompletionOptions,
  ): Promise<T> {
    const model = options?.model ?? this.model;
    const systemPrompt =
      options?.systemPrompt ??
      'You are a helpful assistant that responds with valid JSON only.';

    try {
      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nRespond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}`,
          },
        ],
      });

      const response = await withRetry(
        () =>
          this.client.send(
            new InvokeModelCommand({
              modelId: model,
              contentType: 'application/json',
              accept: 'application/json',
              body: Buffer.from(body),
            }),
          ),
        { label: 'Bedrock.generateStructuredOutput' },
      );

      const parsed = JSON.parse(Buffer.from(response.body).toString('utf-8')) as {
        content: Array<{ type: string; text?: string }>;
      };

      const textContent = parsed.content.find((b) => b.type === 'text');
      if (!textContent?.text) {
        throw new ServiceUnavailableException('Empty response from Bedrock');
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ServiceUnavailableException('No JSON found in Bedrock response');
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      this.logger.error(
        `Bedrock generateStructuredOutput failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      this.logger.warn(
        'Bedrock does not support Claude embeddings. Provide openaiApiKey to enable embeddings.',
      );
      return [];
    }

    try {
      const truncated =
        text.length > EMBEDDING_MAX_CHARS ? text.slice(0, EMBEDDING_MAX_CHARS) : text;

      const response = await withRetry(
        () =>
          this.openaiClient!.embeddings.create({
            model: 'text-embedding-3-small',
            input: truncated,
          }),
        { label: 'Bedrock.generateEmbedding(OpenAI)' },
      );

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Bedrock generateEmbedding (OpenAI delegate) failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  getProviderName(): string {
    return 'bedrock';
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Use Haiku for validation — cheapest model available
      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });

      await withRetry(
        () =>
          this.client.send(
            new InvokeModelCommand({
              modelId: BEDROCK_HAIKU_MODEL,
              contentType: 'application/json',
              accept: 'application/json',
              body: Buffer.from(body),
            }),
          ),
        { label: 'Bedrock.validateConfig' },
      );

      return true;
    } catch (error) {
      this.logger.warn(
        `Bedrock config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  // ─── ToolCapableProvider ─────────────────────────────────────────────────────

  async chat(options: {
    model: string;
    maxTokens: number;
    systemPrompt: string;
    messages: AgentMessage[];
    tools: AgentTool[];
  }): Promise<AgentTurnResult> {
    try {
      const bedrockMessages = this.toBedrockMessages(options.messages);
      const bedrockTools = this.toBedrockTools(options.tools);

      const input: ConverseCommandInput = {
        modelId: options.model,
        system: [{ text: options.systemPrompt }],
        messages: bedrockMessages,
        inferenceConfig: {
          maxTokens: options.maxTokens,
        },
        ...(bedrockTools.length > 0
          ? {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              toolConfig: {
                tools: bedrockTools as any,
                toolChoice: { auto: {} },
              } as ConverseCommandInput['toolConfig'],
            }
          : {}),
      };

      const response = await withRetry(
        () => this.client.send(new ConverseCommand(input)),
        { label: 'Bedrock.chat' },
      );

      return this.fromBedrockConverseResponse(response);
    } catch (error) {
      this.logger.error(
        `Bedrock chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private toBedrockTools(tools: AgentTool[]): unknown[] {
    return tools.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: {
          json: t.inputSchema,
        },
      },
    }));
  }

  private toBedrockMessages(messages: AgentMessage[]): BedrockMessage[] {
    return messages.map((m) => {
      if (typeof m.content === 'string') {
        return {
          role: m.role,
          content: [{ text: m.content }] as BedrockMessage['content'],
        };
      }

      const content = m.content.map((block) => {
        if (block.type === 'text') {
          return { text: block.text };
        }
        if (block.type === 'tool_use') {
          return {
            toolUse: {
              toolUseId: block.id,
              name: block.name,
              input: block.input,
            },
          };
        }
        // tool_result
        const tr = block as ToolResultBlock;
        return {
          toolResult: {
            toolUseId: tr.toolUseId,
            content: [{ text: tr.content }],
            status: tr.isError ? ('error' as const) : ('success' as const),
          },
        };
      }) as BedrockMessage['content'];

      return { role: m.role, content };
    });
  }

  private fromBedrockConverseResponse(response: ConverseCommandOutput): AgentTurnResult {
    // The Converse API response shape
    const output = response.output as
      | { message?: { content?: Array<Record<string, unknown>> } }
      | undefined;

    const stopReason = (response.stopReason as string) ?? 'end_turn';

    const rawContent: Array<Record<string, unknown>> = output?.message?.content ?? [];

    const textBlocks: TextBlock[] = [];
    const toolUseBlocks: ToolUseBlock[] = [];

    for (const block of rawContent) {
      if ('text' in block && typeof block.text === 'string') {
        textBlocks.push({ type: 'text', text: block.text });
      } else if ('toolUse' in block && block.toolUse) {
        const tu = block.toolUse as Record<string, unknown>;
        toolUseBlocks.push({
          type: 'tool_use',
          id: (tu.toolUseId as string) ?? '',
          name: (tu.name as string) ?? '',
          input: (tu.input as Record<string, unknown>) ?? {},
        });
      }
    }

    const assistantContent: ContentBlock[] = [...textBlocks, ...toolUseBlocks];

    // Normalize stopReason to canonical format
    const canonicalStopReason =
      stopReason === 'tool_use'
        ? 'tool_use'
        : stopReason === 'end_turn' || stopReason === 'stop_sequence'
          ? 'end_turn'
          : stopReason === 'max_tokens'
            ? 'max_tokens'
            : stopReason;

    return {
      textBlocks,
      toolUseBlocks,
      stopReason: canonicalStopReason,
      assistantMessage: { role: 'assistant', content: assistantContent },
    };
  }
}

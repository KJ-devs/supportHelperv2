/**
 * BedrockProvider unit tests.
 *
 * The AWS SDK is mocked at the module level so no real network calls are made.
 */

// ─── Mock @aws-sdk/client-bedrock-runtime before any imports ─────────────────
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: jest.fn().mockImplementation((input: unknown) => ({
      _tag: 'InvokeModelCommand',
      input,
    })),
    ConverseCommand: jest.fn().mockImplementation((input: unknown) => ({
      _tag: 'ConverseCommand',
      input,
    })),
  };
});

// ─── Mock openai so the embedding delegate path is tested in isolation ────────
const mockOpenAIEmbeddingsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockOpenAIEmbeddingsCreate,
    },
  }));
});

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { ServiceUnavailableException } from '@nestjs/common';
import { BedrockProvider } from '../../../src/ai/providers/bedrock.provider';
import type { AgentMessage, AgentTool } from '../../../src/ai/providers/tool-capable-provider.interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fake InvokeModel response body (Claude Messages API JSON).
 */
function makeInvokeModelBody(text: string): { body: Uint8Array } {
  const payload = {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'anthropic.claude-sonnet-4-6-v1:0',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  };
  return { body: Buffer.from(JSON.stringify(payload)) };
}

/**
 * Build a fake Converse response (text only).
 */
function makeConverseTextResponse(text: string, stopReason = 'end_turn') {
  return {
    output: {
      message: {
        role: 'assistant',
        content: [{ text }],
      },
    },
    stopReason,
    usage: { inputTokens: 10, outputTokens: 5 },
  };
}

/**
 * Build a fake Converse response with a tool_use block.
 */
function makeConverseToolUseResponse(
  toolUseId: string,
  name: string,
  input: Record<string, unknown>,
) {
  return {
    output: {
      message: {
        role: 'assistant',
        content: [
          {
            toolUse: {
              toolUseId,
              name,
              input,
            },
          },
        ],
      },
    },
    stopReason: 'tool_use',
    usage: { inputTokens: 20, outputTokens: 10 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BedrockProvider', () => {
  let provider: BedrockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    provider = new BedrockProvider({
      region: 'us-east-1',
    });
  });

  // ─── getProviderName ───────────────────────────────────────────────────────

  describe('getProviderName()', () => {
    it('should return "bedrock"', () => {
      expect(provider.getProviderName()).toBe('bedrock');
    });
  });

  // ─── generateCompletion ────────────────────────────────────────────────────

  describe('generateCompletion()', () => {
    it('should return the text content from InvokeModel response', async () => {
      mockSend.mockResolvedValueOnce(makeInvokeModelBody('Hello from Bedrock!'));

      const result = await provider.generateCompletion('Say hello');

      expect(result).toBe('Hello from Bedrock!');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should pass systemPrompt when provided', async () => {
      mockSend.mockResolvedValueOnce(makeInvokeModelBody('ok'));

      await provider.generateCompletion('prompt', {
        systemPrompt: 'You are a test assistant',
        maxTokens: 100,
        temperature: 0.5,
      });

      const callArg = mockSend.mock.calls[0][0] as { input: { body: Buffer } };
      const body = JSON.parse(Buffer.from(callArg.input.body).toString('utf-8')) as {
        system?: string;
        max_tokens: number;
        temperature: number;
      };

      expect(body.system).toBe('You are a test assistant');
      expect(body.max_tokens).toBe(100);
      expect(body.temperature).toBe(0.5);
    });

    it('should return empty string when response content has no text block', async () => {
      mockSend.mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ content: [{ type: 'image' }] })),
      });

      const result = await provider.generateCompletion('prompt');
      expect(result).toBe('');
    });

    it('should rethrow errors from the AWS client', async () => {
      const error = Object.assign(new Error('AccessDenied'), { status: 403 });
      mockSend.mockRejectedValueOnce(error);

      await expect(provider.generateCompletion('prompt')).rejects.toThrow('AccessDenied');
    });
  });

  // ─── generateStructuredOutput ──────────────────────────────────────────────

  describe('generateStructuredOutput()', () => {
    it('should parse JSON from the response text', async () => {
      mockSend.mockResolvedValueOnce(makeInvokeModelBody('{"severity":"high","type":"bug"}'));

      const result = await provider.generateStructuredOutput<{ severity: string; type: string }>(
        'Classify this ticket',
        { type: 'object', properties: { severity: { type: 'string' }, type: { type: 'string' } } },
      );

      expect(result).toEqual({ severity: 'high', type: 'bug' });
    });

    it('should extract JSON wrapped in markdown code fences', async () => {
      mockSend.mockResolvedValueOnce(
        makeInvokeModelBody('Here is the JSON:\n```json\n{"score":42}\n```'),
      );

      const result = await provider.generateStructuredOutput<{ score: number }>(
        'Rate this',
        { type: 'object', properties: { score: { type: 'number' } } },
      );

      expect(result).toEqual({ score: 42 });
    });

    it('should throw ServiceUnavailableException when no JSON is found', async () => {
      mockSend.mockResolvedValueOnce(makeInvokeModelBody('No JSON here'));

      await expect(
        provider.generateStructuredOutput('prompt', {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException when response body is empty', async () => {
      mockSend.mockResolvedValueOnce({
        body: Buffer.from(JSON.stringify({ content: [] })),
      });

      await expect(
        provider.generateStructuredOutput('prompt', {}),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ─── chat() with Converse API ──────────────────────────────────────────────

  describe('chat()', () => {
    const baseOptions = {
      model: 'anthropic.claude-sonnet-4-6-v1:0',
      maxTokens: 1000,
      systemPrompt: 'You are an agent',
      messages: [
        { role: 'user' as const, content: 'Hello agent' },
      ] satisfies AgentMessage[],
      tools: [] as AgentTool[],
    };

    it('should return text blocks when model responds with text', async () => {
      mockSend.mockResolvedValueOnce(makeConverseTextResponse('I am the agent!'));

      const result = await provider.chat(baseOptions);

      expect(result.textBlocks).toHaveLength(1);
      expect(result.textBlocks[0].text).toBe('I am the agent!');
      expect(result.toolUseBlocks).toHaveLength(0);
      expect(result.stopReason).toBe('end_turn');
      expect(result.assistantMessage.role).toBe('assistant');
    });

    it('should return tool_use blocks when model calls a tool', async () => {
      mockSend.mockResolvedValueOnce(
        makeConverseToolUseResponse('tu_123', 'search_tickets', { query: 'login bug' }),
      );

      const result = await provider.chat({
        ...baseOptions,
        tools: [
          {
            name: 'search_tickets',
            description: 'Search tickets',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
      });

      expect(result.toolUseBlocks).toHaveLength(1);
      expect(result.toolUseBlocks[0]).toMatchObject({
        type: 'tool_use',
        id: 'tu_123',
        name: 'search_tickets',
        input: { query: 'login bug' },
      });
      expect(result.stopReason).toBe('tool_use');
    });

    it('should convert string messages to Bedrock content blocks', async () => {
      mockSend.mockResolvedValueOnce(makeConverseTextResponse('ok'));

      await provider.chat(baseOptions);

      const callArg = mockSend.mock.calls[0][0] as {
        input: ConverseCommandInput;
      };
      const messages = callArg.input.messages as Array<{
        role: string;
        content: Array<{ text: string }>;
      }>;

      expect(messages[0].role).toBe('user');
      expect(messages[0].content[0].text).toBe('Hello agent');
    });

    it('should include tool_result blocks correctly in Bedrock messages', async () => {
      mockSend.mockResolvedValueOnce(makeConverseTextResponse('Done'));

      const messagesWithToolResult: AgentMessage[] = [
        { role: 'user', content: 'Find bugs' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'bug' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', toolUseId: 'tu_1', content: '[result: bug found]' },
          ],
        },
      ];

      await provider.chat({ ...baseOptions, messages: messagesWithToolResult });

      const callArg = mockSend.mock.calls[0][0] as {
        input: ConverseCommandInput;
      };
      const messages = callArg.input.messages as Array<{
        role: string;
        content: Array<Record<string, unknown>>;
      }>;

      // The last user message should contain a toolResult block
      const lastMsg = messages[messages.length - 1];
      expect(lastMsg.role).toBe('user');
      const toolResultBlock = lastMsg.content.find((b) => 'toolResult' in b);
      expect(toolResultBlock).toBeDefined();
      expect((toolResultBlock as { toolResult: { toolUseId: string } }).toolResult.toolUseId).toBe('tu_1');
    });

    it('should rethrow errors from Converse API', async () => {
      // Use a non-retryable error (403) so withRetry does not retry and then call with undefined response
      const error = Object.assign(new Error('ThrottlingException'), { status: 403 });
      mockSend.mockRejectedValue(error);

      await expect(provider.chat(baseOptions)).rejects.toThrow('ThrottlingException');
    });
  });

  // ─── validateConfig ────────────────────────────────────────────────────────

  describe('validateConfig()', () => {
    it('should return true when InvokeModel succeeds', async () => {
      mockSend.mockResolvedValueOnce(makeInvokeModelBody('ok'));

      const result = await provider.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false when InvokeModel fails', async () => {
      mockSend.mockRejectedValueOnce(
        Object.assign(new Error('UnauthorizedException'), { status: 401 }),
      );

      const result = await provider.validateConfig();
      expect(result).toBe(false);
    });
  });

  // ─── generateEmbedding ────────────────────────────────────────────────────

  describe('generateEmbedding()', () => {
    it('should return empty array when no OpenAI key is provided', async () => {
      const result = await provider.generateEmbedding('some text');
      expect(result).toEqual([]);
    });

    it('should delegate to OpenAI text-embedding-3-small when openaiApiKey is set', async () => {
      const providerWithEmbeddings = new BedrockProvider({
        region: 'us-east-1',
        openaiApiKey: 'sk-test-key',
      });

      const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
      mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: fakeEmbedding }],
      });

      const result = await providerWithEmbeddings.generateEmbedding('hello world');

      expect(result).toEqual(fakeEmbedding);
      expect(result).toHaveLength(1536);
      expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-small',
          input: 'hello world',
        }),
      );
    });

    it('should truncate input to 32000 characters', async () => {
      const providerWithEmbeddings = new BedrockProvider({
        region: 'us-east-1',
        openaiApiKey: 'sk-test-key',
      });

      mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2] }],
      });

      const longText = 'a'.repeat(40000);
      await providerWithEmbeddings.generateEmbedding(longText);

      const callArg = mockOpenAIEmbeddingsCreate.mock.calls[0][0] as { input: string };
      expect(callArg.input).toHaveLength(32000);
    });

    it('should return empty array when OpenAI embedding fails', async () => {
      const providerWithEmbeddings = new BedrockProvider({
        region: 'us-east-1',
        openaiApiKey: 'sk-test-key',
      });

      mockOpenAIEmbeddingsCreate.mockRejectedValueOnce(
        Object.assign(new Error('API error'), { status: 401 }),
      );

      const result = await providerWithEmbeddings.generateEmbedding('text');
      expect(result).toEqual([]);
    });
  });
});

// Type import for test parameter inspection (not exported by mock, so we use the real type)
type ConverseCommandInput = {
  modelId: string;
  system: Array<{ text: string }>;
  messages: unknown[];
  inferenceConfig: { maxTokens: number };
  toolConfig?: unknown;
};

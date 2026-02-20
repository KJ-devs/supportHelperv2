import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgenticLoopService, AgenticLoopOptions } from '../../../src/modules/agent-v2/agentic-loop.service';
import { ToolExecutorService } from '../../../src/modules/agent-v2/tool-executor.service';
import { AnthropicClientFactory } from '../../../src/modules/ai-config/anthropic-client.factory';
import { AGENT_TOOLS } from '../../../src/modules/agent-v2/agent-tools';
import Anthropic from '@anthropic-ai/sdk';

describe('AgenticLoopService', () => {
  let service: AgenticLoopService;
  let toolExecutor: jest.Mocked<ToolExecutorService>;
  let anthropicFactory: jest.Mocked<AnthropicClientFactory>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockTicket = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
    title: 'Bug report',
    description: 'Something is broken',
    status: 'open',
  };

  const baseOptions: AgenticLoopOptions = {
    systemPrompt: 'You are a debugging assistant.',
    initialMessage: 'Please investigate this bug.',
    tools: AGENT_TOOLS,
    repoCtx: null,
    ticket: mockTicket,
    tenantId: 'tenant-123',
    ticketId: 'ticket-123',
    sessionId: 'session-abc',
  };

  const createMockAnthropicClient = (responses: Anthropic.Message[]) => {
    let callCount = 0;
    return {
      messages: {
        create: jest.fn().mockImplementation(() => {
          const response = responses[callCount] ?? responses[responses.length - 1];
          callCount++;
          return Promise.resolve(response);
        }),
      },
    };
  };

  const makeTextResponse = (text: string): Anthropic.Message => ({
    id: 'msg-1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  const makeToolUseResponse = (
    toolName: string,
    toolId: string,
    input: Record<string, unknown>,
  ): Anthropic.Message => ({
    id: 'msg-2',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'tool_use', id: toolId, name: toolName, input },
    ],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  beforeEach(async () => {
    const mockToolExecutor = {
      execute: jest.fn().mockResolvedValue({ content: 'tool result' }),
    };

    const mockAnthropicFactory = {
      createForTenant: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenticLoopService,
        { provide: ToolExecutorService, useValue: mockToolExecutor },
        { provide: AnthropicClientFactory, useValue: mockAnthropicFactory },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AgenticLoopService>(AgenticLoopService);
    toolExecutor = module.get(ToolExecutorService);
    anthropicFactory = module.get(AnthropicClientFactory);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('run', () => {
    it('throws ServiceUnavailableException when no AI client configured', async () => {
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(null);

      await expect(service.run(baseOptions)).rejects.toThrow(ServiceUnavailableException);
      await expect(service.run(baseOptions)).rejects.toThrow(
        'No Anthropic API key configured',
      );
    });

    it('returns finalContent immediately when no tool_use blocks', async () => {
      const mockClient = createMockAnthropicClient([
        makeTextResponse('Here is my analysis of the bug.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);

      const result = await service.run(baseOptions);

      expect(result.finalContent).toBe('Here is my analysis of the bug.');
      expect(result.iterations).toBe(1);
      expect(result.toolCallLog).toHaveLength(0);
      expect(toolExecutor.execute).not.toHaveBeenCalled();
    });

    it('executes tool calls and appends results to messages', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextResponse('Found the bug in auth.ts'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('file content');

      const result = await service.run(baseOptions);

      expect(toolExecutor.execute).toHaveBeenCalledWith(
        'read_file',
        { file_path: 'src/auth.ts' },
        expect.objectContaining({ tenantId: 'tenant-123' }),
      );
      expect(result.toolCallLog).toHaveLength(1);
      expect(result.toolCallLog[0].name).toBe('read_file');
      expect(result.finalContent).toBe('Found the bug in auth.ts');
    });

    it('loops until no more tool_use blocks', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeToolUseResponse('search_code', 'tool-2', { query: 'token' }),
        makeTextResponse('Root cause identified.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('result');

      const result = await service.run(baseOptions);

      expect(result.iterations).toBe(3);
      expect(result.toolCallLog).toHaveLength(2);
      expect(result.finalContent).toBe('Root cause identified.');
    });

    it('stops at maxIterations limit', async () => {
      // Always returns tool calls — loop should stop at maxIterations
      const infiniteToolResponse = makeToolUseResponse('read_file', 'tool-x', { file_path: 'a.ts' });
      const mockClient = {
        messages: {
          create: jest.fn().mockResolvedValue(infiniteToolResponse),
        },
      };
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('result');

      const result = await service.run({ ...baseOptions, maxIterations: 3 });

      expect(result.iterations).toBe(3);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(3);
    });

    it('emits agent:thinking event at each iteration', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-1', { file_path: 'src/a.ts' }),
        makeTextResponse('Done.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('result');

      await service.run(baseOptions);

      expect(eventEmitter.emit).toHaveBeenCalledWith('agent:thinking', {
        ticketId: 'ticket-123',
        sessionId: 'session-abc',
        iteration: 1,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('agent:thinking', {
        ticketId: 'ticket-123',
        sessionId: 'session-abc',
        iteration: 2,
      });
    });

    it('emits agent:tool_call before tool execution', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextResponse('Analysis done.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('file content');

      await service.run(baseOptions);

      expect(eventEmitter.emit).toHaveBeenCalledWith('agent:tool_call', {
        ticketId: 'ticket-123',
        sessionId: 'session-abc',
        toolName: 'read_file',
        input: { file_path: 'src/auth.ts' },
      });
    });

    it('emits agent:tool_result after tool execution with durationMs', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextResponse('Done.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('file content');

      await service.run(baseOptions);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent:tool_result',
        expect.objectContaining({
          ticketId: 'ticket-123',
          sessionId: 'session-abc',
          toolName: 'read_file',
          durationMs: expect.any(Number),
          hasError: false,
        }),
      );
    });

    it('emits agent:complete with finalContent', async () => {
      const mockClient = createMockAnthropicClient([
        makeTextResponse('Analysis complete.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);

      await service.run(baseOptions);

      expect(eventEmitter.emit).toHaveBeenCalledWith('agent:complete', {
        ticketId: 'ticket-123',
        sessionId: 'session-abc',
        finalContent: 'Analysis complete.',
      });
    });

    it('includes existingMessages in conversation history', async () => {
      const mockClient = createMockAnthropicClient([
        makeTextResponse('Based on the history, here is my analysis.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);

      const existingMessages: Anthropic.MessageParam[] = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ];

      await service.run({ ...baseOptions, existingMessages });

      const createCallArgs = (mockClient.messages.create as jest.Mock).mock.calls[0][0];
      // Should contain existing messages plus the new initial message
      expect(createCallArgs.messages).toHaveLength(3);
      expect(createCallArgs.messages[0]).toEqual({ role: 'user', content: 'Previous question' });
    });

    it('records toolCallLog entry with error when tool throws', async () => {
      const mockClient = createMockAnthropicClient([
        makeToolUseResponse('read_file', 'tool-err', { file_path: 'missing.ts' }),
        makeTextResponse('Could not read file.'),
      ]);
      (anthropicFactory.createForTenant as jest.Mock).mockResolvedValue(mockClient);
      (toolExecutor.execute as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await service.run(baseOptions);

      expect(result.toolCallLog[0].error).toBe('File not found');
      expect(result.toolCallLog[0].result).toEqual({ error: 'File not found' });
    });
  });
});

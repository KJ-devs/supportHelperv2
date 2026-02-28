jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgenticLoopService, AgenticLoopOptions } from '../../../src/modules/agent-v2/agentic-loop.service';
import { ToolExecutorService } from '../../../src/modules/agent-v2/tool-executor.service';
import { ToolCapableProviderFactory } from '../../../src/modules/ai-config/tool-capable-provider.factory';
import { AiConfigService } from '../../../src/modules/ai-config/ai-config.service';
import { AGENT_TOOLS } from '../../../src/modules/agent-v2/agent-tools';
import type { ToolCapableProvider, AgentTurnResult } from '../../../src/ai/providers/tool-capable-provider.interface';

describe('AgenticLoopService', () => {
  let service: AgenticLoopService;
  let toolExecutor: jest.Mocked<ToolExecutorService>;
  let providerFactory: jest.Mocked<ToolCapableProviderFactory>;
  let aiConfigService: jest.Mocked<AiConfigService>;
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

  const makeTextTurn = (text: string): AgentTurnResult => ({
    textBlocks: [{ type: 'text', text }],
    toolUseBlocks: [],
    stopReason: 'end_turn',
    assistantMessage: { role: 'assistant', content: [{ type: 'text', text }] },
  });

  const makeToolUseTurn = (
    toolName: string,
    toolId: string,
    input: Record<string, unknown>,
  ): AgentTurnResult => ({
    textBlocks: [],
    toolUseBlocks: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    stopReason: 'tool_use',
    assistantMessage: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    },
  });

  const createMockProvider = (turns: AgentTurnResult[]): ToolCapableProvider => {
    let callCount = 0;
    return {
      chat: jest.fn().mockImplementation(() => {
        const turn = turns[callCount] ?? turns[turns.length - 1];
        callCount++;
        return Promise.resolve(turn);
      }),
    };
  };

  beforeEach(async () => {
    const mockToolExecutor = {
      execute: jest.fn().mockResolvedValue({ content: 'tool result' }),
    };

    const mockProviderFactory = {
      createForTenant: jest.fn(),
    };

    const mockAiConfigService = {
      getFullConfig: jest.fn().mockResolvedValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-test',
      }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgenticLoopService,
        { provide: ToolExecutorService, useValue: mockToolExecutor },
        { provide: ToolCapableProviderFactory, useValue: mockProviderFactory },
        { provide: AiConfigService, useValue: mockAiConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AgenticLoopService>(AgenticLoopService);
    toolExecutor = module.get(ToolExecutorService);
    providerFactory = module.get(ToolCapableProviderFactory);
    aiConfigService = module.get(AiConfigService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('run', () => {
    it('throws ServiceUnavailableException when no AI provider configured', async () => {
      (providerFactory.createForTenant as jest.Mock).mockRejectedValue(
        new ServiceUnavailableException(
          'No AI provider configured for this tenant. Set up an AI provider in Settings.',
        ),
      );

      await expect(service.run(baseOptions)).rejects.toThrow(ServiceUnavailableException);
    });

    it('returns finalContent immediately when no tool_use blocks', async () => {
      const mockProvider = createMockProvider([makeTextTurn('Here is my analysis of the bug.')]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);

      const result = await service.run(baseOptions);

      expect(result.finalContent).toBe('Here is my analysis of the bug.');
      expect(result.iterations).toBe(1);
      expect(result.toolCallLog).toHaveLength(0);
      expect(toolExecutor.execute).not.toHaveBeenCalled();
    });

    it('executes tool calls and appends results to messages', async () => {
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextTurn('Found the bug in auth.ts'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
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
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeToolUseTurn('search_code', 'tool-2', { query: 'token' }),
        makeTextTurn('Root cause identified.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('result');

      const result = await service.run(baseOptions);

      expect(result.iterations).toBe(3);
      expect(result.toolCallLog).toHaveLength(2);
      expect(result.finalContent).toBe('Root cause identified.');
    });

    it('stops at maxIterations limit', async () => {
      const infiniteToolTurn = makeToolUseTurn('read_file', 'tool-x', { file_path: 'a.ts' });
      const mockProvider = {
        chat: jest.fn().mockResolvedValue(infiniteToolTurn),
      };
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
      (toolExecutor.execute as jest.Mock).mockResolvedValue('result');

      const result = await service.run({ ...baseOptions, maxIterations: 3 });

      expect(result.iterations).toBe(3);
      expect(mockProvider.chat).toHaveBeenCalledTimes(3);
    });

    it('emits agent:thinking event at each iteration', async () => {
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-1', { file_path: 'src/a.ts' }),
        makeTextTurn('Done.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
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
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextTurn('Analysis done.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
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
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-1', { file_path: 'src/auth.ts' }),
        makeTextTurn('Done.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
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
      const mockProvider = createMockProvider([makeTextTurn('Analysis complete.')]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);

      await service.run(baseOptions);

      expect(eventEmitter.emit).toHaveBeenCalledWith('agent:complete', {
        ticketId: 'ticket-123',
        sessionId: 'session-abc',
        finalContent: 'Analysis complete.',
      });
    });

    it('includes existingMessages in conversation history', async () => {
      const mockProvider = createMockProvider([
        makeTextTurn('Based on the history, here is my analysis.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);

      const existingMessages = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ];

      await service.run({ ...baseOptions, existingMessages });

      const chatCallArgs = (mockProvider.chat as jest.Mock).mock.calls[0][0];
      // chatCallArgs.messages is a mutable array reference — check order, not length,
      // since the service appends the assistant turn to the SAME array after chat() returns.
      // At minimum the existing messages are at the front and the initial message follows.
      expect(chatCallArgs.messages[0]).toEqual({ role: 'user', content: 'Previous question' });
      expect(chatCallArgs.messages[1]).toEqual({ role: 'assistant', content: 'Previous answer' });
      expect(chatCallArgs.messages[2]).toEqual({ role: 'user', content: baseOptions.initialMessage });
    });

    it('records toolCallLog entry with error when tool throws', async () => {
      const mockProvider = createMockProvider([
        makeToolUseTurn('read_file', 'tool-err', { file_path: 'missing.ts' }),
        makeTextTurn('Could not read file.'),
      ]);
      (providerFactory.createForTenant as jest.Mock).mockResolvedValue(mockProvider);
      (toolExecutor.execute as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await service.run(baseOptions);

      expect(result.toolCallLog[0].error).toBe('File not found');
      expect(result.toolCallLog[0].result).toEqual({ error: 'File not found' });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  OpenAIService,
} from './openai.service';
import { PrismaService } from './prisma.service';

// Mock Anthropic SDK
const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicCreate,
    },
  }));
});

// Mock OpenAI (used for embeddings only)
const mockEmbeddingsCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockEmbeddingsCreate,
    },
  }));
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    incrbyfloat: jest.fn(),
    hincrby: jest.fn(),
    hgetall: jest.fn(),
    expire: jest.fn(),
  }));
});

describe('OpenAIService', () => {
  let service: OpenAIService;
  let prismaService: PrismaService;
  let mockRedis: any;

  const mockAnthropicConfig = {
    apiKey: 'test-anthropic-key',
    models: {
      vision: 'claude-sonnet-4-6',
      chat: 'claude-sonnet-4-6',
      chatFast: 'claude-haiku-4-5-20251001',
    },
    vision: {
      maxTokens: 4096,
      temperature: 0.3,
      batchSize: 10,
    },
  };

  const mockOpenaiConfig = {
    apiKey: 'test-openai-key',
    models: {
      embedding: 'text-embedding-3-large',
    },
    embedding: {
      dimensions: 3072,
      batchSize: 100,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'anthropic') return mockAnthropicConfig;
              if (key === 'openai') return mockOpenaiConfig;
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn(),
            $executeRawUnsafe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OpenAIService>(OpenAIService);
    module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Initialize Redis mock
    await service.onModuleInit();
    mockRedis = (service as unknown).redis;
  });

  describe('analyzeVideo', () => {
    const mockFrames = [Buffer.from('frame1'), Buffer.from('frame2')];
    const tenantId = 'test-tenant-id';

    const mockVideoAnalysisResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'User clicked button and error appeared',
            severity: 'high',
            type: 'bug',
            reproSteps: ['Open app', 'Click button', 'See error'],
            component: 'Dashboard',
            uiElements: ['button', 'modal'],
            errorMessages: ['Error: Failed to load'],
            confidence: {
              overall: 0.9,
              severity: 0.85,
              type: 0.9,
              component: 0.8,
            },
          }),
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
      },
    };

    it('should analyze video frames successfully', async () => {
      mockAnthropicCreate.mockResolvedValue(mockVideoAnalysisResponse);

      const result = await service.analyzeVideo(mockFrames, tenantId);

      expect(result).toMatchObject({
        summary: 'User clicked button and error appeared',
        severity: 'high',
        type: 'bug',
        component: 'Dashboard',
      });
      expect(result.reproSteps).toHaveLength(3);
      expect(result.confidence.overall).toBe(0.9);
    });

    it('should use Claude model for vision analysis', async () => {
      mockAnthropicCreate.mockResolvedValue(mockVideoAnalysisResponse);

      await service.analyzeVideo(mockFrames, tenantId);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-6',
        })
      );
    });

    it('should handle context with OCR text and UI detections', async () => {
      mockAnthropicCreate.mockResolvedValue(mockVideoAnalysisResponse);

      const context = {
        ocrText: 'Error: Something went wrong',
        uiDetections: [{ type: 'button', text: 'Submit' }],
      };

      const result = await service.analyzeVideo(mockFrames, tenantId, context);

      expect(result.summary).toBeDefined();
      expect(mockAnthropicCreate).toHaveBeenCalled();
    });

    it('should return fallback analysis on API error', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API Error'));

      const result = await service.analyzeVideo(mockFrames, tenantId);

      expect(result.summary).toBe('Video analysis unavailable - API error');
      expect(result.confidence.overall).toBe(0);
    });

    it('should select key frames when too many frames provided', async () => {
      mockAnthropicCreate.mockResolvedValue(mockVideoAnalysisResponse);

      const manyFrames = Array(50)
        .fill(null)
        .map((_, i) => Buffer.from(`frame${i}`));
      await service.analyzeVideo(manyFrames, tenantId);

      // Should have selected max 10 key frames
      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      const imageCount = callArgs.messages[0].content.filter(
        (c: any) => c.type === 'image'
      ).length;
      expect(imageCount).toBeLessThanOrEqual(10);
    });
  });

  describe('classifyTicket', () => {
    const tenantId = 'test-tenant-id';

    const mockClassificationResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            type: 'bug',
            severity: 'high',
            keywords: ['crash', 'login', 'authentication'],
            confidence: { type: 0.95, severity: 0.9 },
          }),
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    it('should classify ticket successfully', async () => {
      mockAnthropicCreate.mockResolvedValue(mockClassificationResponse);

      const result = await service.classifyTicket('App crashes when logging in', tenantId);

      expect(result.type).toBe('bug');
      expect(result.severity).toBe('high');
      expect(result.keywords).toContain('crash');
      expect(result.confidence.type).toBe(0.95);
    });

    it('should use Claude Haiku for classification', async () => {
      mockAnthropicCreate.mockResolvedValue(mockClassificationResponse);

      await service.classifyTicket('Test ticket', tenantId);

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
        })
      );
    });

    it('should return fallback classification on error', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('API Error'));

      const result = await service.classifyTicket('Test ticket', tenantId);

      expect(result.type).toBe('bug');
      expect(result.severity).toBe('medium');
      expect(result.confidence.type).toBe(0);
    });

    it('should normalize invalid severity values', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              type: 'bug',
              severity: 'invalid-severity',
              keywords: [],
              confidence: { type: 0.5, severity: 0.5 },
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await service.classifyTicket('Test', tenantId);

      expect(result.severity).toBe('medium'); // Default fallback
    });

    it('should truncate long text input', async () => {
      mockAnthropicCreate.mockResolvedValue(mockClassificationResponse);

      const longText = 'a'.repeat(10000);
      await service.classifyTicket(longText, tenantId);

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      const userContent = callArgs.messages[0].content;
      expect(userContent.length).toBeLessThanOrEqual(4000);
    });
  });

  describe('generateEmbedding', () => {
    const mockEmbedding = Array(3072).fill(0.1);
    const mockEmbeddingResponse = {
      data: [{ embedding: mockEmbedding }],
      usage: { prompt_tokens: 50, total_tokens: 50 },
    };

    it('should generate embedding successfully via OpenAI', async () => {
      mockRedis.get.mockResolvedValue(null); // No cache
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);

      const result = await service.generateEmbedding('Test text');

      expect(result.embedding).toHaveLength(3072);
      expect(result.dimensions).toBe(3072);
      expect(result.cached).toBe(false);
    });

    it('should return cached embedding when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEmbedding));

      const result = await service.generateEmbedding('Test text');

      expect(result.cached).toBe(true);
      expect(result.embedding).toHaveLength(3072);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('should cache new embeddings in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);

      await service.generateEmbedding('Test text');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('openai:embedding:'),
        86400, // 24 hours
        expect.any(String)
      );
    });

    it('should use text-embedding-3-large model', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);

      await service.generateEmbedding('Test text');

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-large',
          dimensions: 3072,
        })
      );
    });

    it('should truncate long text', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);

      const longText = 'a'.repeat(50000);
      const result = await service.generateEmbedding(longText);

      expect(result.text.length).toBeLessThanOrEqual(32000);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockEmbeddingsCreate.mockResolvedValue(mockEmbeddingResponse);

      const result = await service.generateEmbedding('Test text');

      expect(result.embedding).toHaveLength(3072);
      expect(result.cached).toBe(false);
    });
  });

  describe('searchSimilarTickets', () => {
    const mockEmbedding = Array(3072).fill(0.1);
    const mockTickets = [
      {
        id: 'ticket-1',
        title: 'Bug 1',
        description: 'Desc 1',
        type: 'bug',
        severity: 'high',
        status: 'open',
        similarity: 0.95,
      },
      {
        id: 'ticket-2',
        title: 'Bug 2',
        description: 'Desc 2',
        type: 'bug',
        severity: 'medium',
        status: 'closed',
        similarity: 0.85,
      },
    ];

    it('should search similar tickets using pgvector', async () => {
      (prismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockTickets);

      const result = await service.searchSimilarTickets(mockEmbedding, 10);

      expect(result).toHaveLength(2);
      expect(result[0]?.similarity).toBe(0.95);
      expect(prismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('embedding <=>'),
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should filter by tenant when provided', async () => {
      (prismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockTickets);

      await service.searchSimilarTickets(mockEmbedding, 10, 'tenant-123');

      expect(prismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        expect.any(String),
        'tenant-123',
        expect.any(Number)
      );
    });

    it('should exclude specific ticket when provided', async () => {
      (prismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockTickets);

      await service.searchSimilarTickets(mockEmbedding, 10, undefined, 'exclude-id');

      expect(prismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('id !='),
        expect.any(String),
        'exclude-id',
        expect.any(Number)
      );
    });

    it('should return empty array on error', async () => {
      (prismaService.$queryRawUnsafe as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await service.searchSimilarTickets(mockEmbedding, 10);

      expect(result).toEqual([]);
    });
  });

  describe('storeTicketEmbedding', () => {
    const mockEmbedding = Array(3072).fill(0.1);

    it('should store embedding for ticket', async () => {
      (prismaService.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      await service.storeTicketEmbedding('ticket-123', mockEmbedding);

      expect(prismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tickets SET embedding'),
        expect.stringContaining('[0.1'),
        'ticket-123'
      );
    });

    it('should throw error on failure', async () => {
      (prismaService.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(service.storeTicketEmbedding('ticket-123', mockEmbedding)).rejects.toThrow(
        'DB Error'
      );
    });
  });

  describe('Rate Limiting', () => {
    const tenantId = 'rate-limit-tenant';

    beforeEach(() => {
      // Reset rate limit state
      (service as unknown).rateLimitState.clear();
    });

    it('should allow requests within rate limit', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      // Should not throw for first requests
      for (let i = 0; i < 10; i++) {
        await expect(service.classifyTicket('Test', tenantId)).resolves.toBeDefined();
      }
    });

    it('should throw when rate limit exceeded', async () => {
      // Manually set rate limit state to exceeded
      (service as unknown).rateLimitState.set(tenantId, {
        requestCount: 50,
        windowStart: Date.now(),
      });

      await expect(service.classifyTicket('Test', tenantId)).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should reset rate limit after window expires', async () => {
      // Set rate limit state from the past
      (service as unknown).rateLimitState.set(tenantId, {
        requestCount: 50,
        windowStart: Date.now() - 70000, // 70 seconds ago
      });

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      // Should not throw - window has reset
      await expect(service.classifyTicket('Test', tenantId)).resolves.toBeDefined();
    });

    it('should return correct rate limit status', () => {
      (service as unknown).rateLimitState.set(tenantId, {
        requestCount: 30,
        windowStart: Date.now(),
      });

      const status = service.getRateLimitStatus(tenantId);

      expect(status.remaining).toBe(20);
      expect(status.resetIn).toBeGreaterThan(0);
    });

    it('should return full limit for new tenant', () => {
      const status = service.getRateLimitStatus('new-tenant');

      expect(status.remaining).toBe(50);
      expect(status.resetIn).toBe(0);
    });
  });

  describe('Cost Tracking', () => {
    const tenantId = 'cost-tracking-tenant';

    it('should track costs after API calls', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
        usage: { input_tokens: 1000, output_tokens: 500 },
      });

      await service.classifyTicket('Test', tenantId);

      expect(mockRedis.incrbyfloat).toHaveBeenCalled();
      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('tokens'),
        'input',
        1000
      );
      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('tokens'),
        'output',
        500
      );
    });

    it('should get cost summary', async () => {
      mockRedis.get.mockResolvedValue('0.50');
      mockRedis.hgetall.mockImplementation((key: string) => {
        if (key.includes('tokens')) {
          return Promise.resolve({ input: '10000', output: '5000' });
        }
        if (key.includes('requests')) {
          return Promise.resolve({ 'claude-haiku-4-5-20251001': '100' });
        }
        return Promise.resolve({});
      });

      const summary = await service.getCostSummary(tenantId, 7);

      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.totalTokens.input).toBeGreaterThan(0);
      expect(summary.byDay).toBeDefined();
    });
  });

  describe('Legacy Methods', () => {
    it('should maintain backward compatibility with analyzeFrames', async () => {
      // Mock fs.readFile
      jest.mock('fs/promises', () => ({
        readFile: jest.fn().mockResolvedValue(Buffer.from('test-image')),
      }));

      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Test summary',
              uiElements: ['button'],
              actions: ['click'],
              errorMessages: ['error'],
              recommendations: ['fix'],
            }),
          },
        ],
      });

      const result = await service.analyzeFrames(['/path/to/frame1.png'], 'OCR text', [
        { type: 'button' },
      ]);

      expect(result.summary).toBeDefined();
      expect(result.uiElements).toBeDefined();
    });

    it('should maintain backward compatibility with chat method', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Test response',
          },
        ],
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Test response');
    });

    it('should maintain backward compatibility with classify method', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: { value: 'bug', confidence: 0.9 },
            }),
          },
        ],
      });

      const result = await service.classify({
        text: 'Test text',
        categories: { category: ['bug', 'feature'] },
      });

      expect(result.category).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle Anthropic API errors gracefully', async () => {
      mockAnthropicCreate.mockRejectedValue(
        new Error('Anthropic API rate limit exceeded')
      );

      const result = await service.classifyTicket('Test', 'tenant');

      // Should return fallback, not throw
      expect(result.type).toBe('bug');
      expect(result.severity).toBe('medium');
    });

    it('should handle malformed JSON responses', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'not valid json at all no braces',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      const result = await service.classifyTicket('Test', 'tenant');

      expect(result).toBeDefined();
      expect(result.confidence.type).toBe(0); // Fallback
    });

    it('should handle empty API responses', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      const result = await service.classifyTicket('Test', 'tenant');

      expect(result).toBeDefined();
    });

    it('should extract JSON from markdown code blocks', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```json\n{"type":"bug","severity":"high","keywords":["crash"],"confidence":{"type":0.9,"severity":0.8}}\n```',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
      });

      const result = await service.classifyTicket('Test', 'tenant');

      expect(result.type).toBe('bug');
      expect(result.severity).toBe('high');
    });
  });
});

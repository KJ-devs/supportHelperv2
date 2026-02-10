import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  OpenAIService,
} from './openai.service';
import { PrismaService } from './prisma.service';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
    embeddings: {
      create: jest.fn(),
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
  let mockOpenAI: any;
  let mockRedis: any;

  const mockConfig = {
    apiKey: 'test-api-key',
    models: {
      vision: 'gpt-4o',
      chat: 'gpt-4o',
      embedding: 'text-embedding-3-large',
    },
    vision: {
      maxTokens: 4096,
      temperature: 0.7,
      batchSize: 10,
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
            get: jest.fn().mockReturnValue(mockConfig),
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
    module.get<ConfigService>(ConfigService); // Needed for module initialization
    prismaService = module.get<PrismaService>(PrismaService);

    // Get mock instances
    mockOpenAI = (service as any).client;

    // Initialize Redis mock
    await service.onModuleInit();
    mockRedis = (service as any).redis;
  });

  describe('analyzeVideo', () => {
    const mockFrames = [Buffer.from('frame1'), Buffer.from('frame2')];
    const tenantId = 'test-tenant-id';

    const mockVideoAnalysisResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
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
        },
      ],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        total_tokens: 1200,
      },
    };

    it('should analyze video frames successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockVideoAnalysisResponse);

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

    it('should handle context with OCR text and UI detections', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockVideoAnalysisResponse);

      const context = {
        ocrText: 'Error: Something went wrong',
        uiDetections: [{ type: 'button', text: 'Submit' }],
      };

      const result = await service.analyzeVideo(mockFrames, tenantId, context);

      expect(result.summary).toBeDefined();
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should return fallback analysis on API error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await service.analyzeVideo(mockFrames, tenantId);

      expect(result.summary).toBe('Video analysis unavailable - API error');
      expect(result.confidence.overall).toBe(0);
    });

    it('should select key frames when too many frames provided', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockVideoAnalysisResponse);

      const manyFrames = Array(50)
        .fill(null)
        .map((_, i) => Buffer.from(`frame${i}`));
      await service.analyzeVideo(manyFrames, tenantId);

      // Should have selected max 10 key frames
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const imageCount = callArgs.messages[1].content.filter(
        (c: any) => c.type === 'image_url'
      ).length;
      expect(imageCount).toBeLessThanOrEqual(10);
    });
  });

  describe('classifyTicket', () => {
    const tenantId = 'test-tenant-id';

    const mockClassificationResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              type: 'bug',
              severity: 'high',
              keywords: ['crash', 'login', 'authentication'],
              confidence: { type: 0.95, severity: 0.9 },
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };

    it('should classify ticket successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockClassificationResponse);

      const result = await service.classifyTicket('App crashes when logging in', tenantId);

      expect(result.type).toBe('bug');
      expect(result.severity).toBe('high');
      expect(result.keywords).toContain('crash');
      expect(result.confidence.type).toBe(0.95);
    });

    it('should use gpt-4o-mini for classification', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockClassificationResponse);

      await service.classifyTicket('Test ticket', tenantId);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        })
      );
    });

    it('should return fallback classification on error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await service.classifyTicket('Test ticket', tenantId);

      expect(result.type).toBe('bug');
      expect(result.severity).toBe('medium');
      expect(result.confidence.type).toBe(0);
    });

    it('should normalize invalid severity values', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'bug',
                severity: 'invalid-severity',
                keywords: [],
                confidence: { type: 0.5, severity: 0.5 },
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await service.classifyTicket('Test', tenantId);

      expect(result.severity).toBe('medium'); // Default fallback
    });

    it('should truncate long text input', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockClassificationResponse);

      const longText = 'a'.repeat(10000);
      await service.classifyTicket(longText, tenantId);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userContent = callArgs.messages[1].content;
      expect(userContent.length).toBeLessThanOrEqual(4000);
    });
  });

  describe('generateEmbedding', () => {
    const mockEmbedding = Array(3072).fill(0.1);
    const mockEmbeddingResponse = {
      data: [{ embedding: mockEmbedding }],
      usage: { prompt_tokens: 50, total_tokens: 50 },
    };

    it('should generate embedding successfully', async () => {
      mockRedis.get.mockResolvedValue(null); // No cache
      mockOpenAI.embeddings.create.mockResolvedValue(mockEmbeddingResponse);

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
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });

    it('should cache new embeddings in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue(mockEmbeddingResponse);

      await service.generateEmbedding('Test text');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('openai:embedding:'),
        86400, // 24 hours
        expect.any(String)
      );
    });

    it('should use text-embedding-3-large model', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue(mockEmbeddingResponse);

      await service.generateEmbedding('Test text');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'text-embedding-3-large',
          dimensions: 3072,
        })
      );
    });

    it('should truncate long text', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue(mockEmbeddingResponse);

      const longText = 'a'.repeat(50000);
      const result = await service.generateEmbedding(longText);

      expect(result.text.length).toBeLessThanOrEqual(32000);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      mockOpenAI.embeddings.create.mockResolvedValue(mockEmbeddingResponse);

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
      (service as any).rateLimitState.clear();
    });

    it('should allow requests within rate limit', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      // Should not throw for first 50 requests
      for (let i = 0; i < 10; i++) {
        await expect(service.classifyTicket('Test', tenantId)).resolves.toBeDefined();
      }
    });

    it('should throw when rate limit exceeded', async () => {
      // Manually set rate limit state to exceeded
      (service as any).rateLimitState.set(tenantId, {
        requestCount: 50,
        windowStart: Date.now(),
      });

      await expect(service.classifyTicket('Test', tenantId)).rejects.toThrow(/Rate limit exceeded/);
    });

    it('should reset rate limit after window expires', async () => {
      // Set rate limit state from the past
      (service as any).rateLimitState.set(tenantId, {
        requestCount: 50,
        windowStart: Date.now() - 70000, // 70 seconds ago
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      // Should not throw - window has reset
      await expect(service.classifyTicket('Test', tenantId)).resolves.toBeDefined();
    });

    it('should return correct rate limit status', () => {
      (service as any).rateLimitState.set(tenantId, {
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
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
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
          return Promise.resolve({ 'gpt-4o-mini': '100' });
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

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Test summary',
                uiElements: ['button'],
                actions: ['click'],
                errorMessages: ['error'],
                recommendations: ['fix'],
              }),
            },
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
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Test response',
              tool_calls: [],
            },
          },
        ],
      });

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.content).toBe('Test response');
    });

    it('should maintain backward compatibility with classify method', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: { value: 'bug', confidence: 0.9 },
              }),
            },
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
    it('should handle OpenAI API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );

      const result = await service.classifyTicket('Test', 'tenant');

      // Should return fallback, not throw
      expect(result.type).toBe('bug');
      expect(result.severity).toBe('medium');
    });

    it('should handle malformed JSON responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: { content: 'not valid json' },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const result = await service.classifyTicket('Test', 'tenant');

      expect(result).toBeDefined();
      expect(result.confidence.type).toBe(0); // Fallback
    });

    it('should handle empty API responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const result = await service.classifyTicket('Test', 'tenant');

      expect(result).toBeDefined();
    });
  });
});

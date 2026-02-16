import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../../../src/ai/ai.service';
import { AIProviderFactory } from '../../../src/ai/providers/ai-provider.factory';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIProvider } from '../../../src/ai/providers/ai-provider.interface';

describe('AIService', () => {
  let service: AIService;
  let mockProvider: jest.Mocked<AIProvider>;
  let mockProviderFactory: jest.Mocked<AIProviderFactory>;

  const createMockProvider = (): jest.Mocked<AIProvider> => ({
    generateCompletion: jest.fn(),
    generateStructuredOutput: jest.fn(),
    generateEmbedding: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('anthropic'),
    validateConfig: jest.fn().mockResolvedValue(true),
  });

  describe('when Anthropic is configured', () => {
    beforeEach(async () => {
      mockProvider = createMockProvider();
      mockProviderFactory = {
        create: jest.fn().mockReturnValue(mockProvider),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test-key';
                return undefined;
              }),
            },
          },
          {
            provide: AIProviderFactory,
            useValue: mockProviderFactory,
          },
          {
            provide: PrismaService,
            useValue: {
              aiConfig: {
                findUnique: jest.fn().mockResolvedValue(null),
              },
              systemConfig: {
                upsert: jest.fn(),
              },
            },
          },
        ],
      }).compile();

      service = module.get<AIService>(AIService);
    });

    describe('analyzeVideoTranscript', () => {
      it('should analyze transcript and return result', async () => {
        mockProvider.generateStructuredOutput.mockResolvedValue({
          summary: 'Button not working',
          severity: 'high',
          severityConfidence: 0.9,
          type: 'bug',
          typeConfidence: 0.85,
          keywords: ['button', 'click'],
          reproductionSteps: ['Click submit'],
        });

        const result = await service.analyzeVideoTranscript('The submit button does not work');

        expect(result.summary).toBe('Button not working');
        expect(result.severity).toBe('high');
        expect(result.type).toBe('bug');
        expect(result.keywords).toContain('button');
      });

      it('should return mock analysis on error', async () => {
        mockProvider.generateStructuredOutput.mockRejectedValue(new Error('API Error'));

        const result = await service.analyzeVideoTranscript('test transcript');

        expect(result.severity).toBe('medium');
        expect(result.type).toBe('other');
      });
    });

    describe('processUserDescription', () => {
      it('should process and enrich user description', async () => {
        mockProvider.generateStructuredOutput.mockResolvedValue({
          enrichedDescription: 'Enriched bug report',
          summary: 'Bug in form',
          severity: 'medium',
          severityConfidence: 0.7,
          type: 'bug',
          typeConfidence: 0.8,
          keywords: ['form', 'bug'],
          reproductionSteps: ['Open form', 'Submit'],
        });

        const result = await service.processUserDescription('form is broken');

        expect(result.enrichedDescription).toBe('Enriched bug report');
        expect(result.summary).toBe('Bug in form');
      });

      it('should return fallback on error', async () => {
        mockProvider.generateStructuredOutput.mockRejectedValue(new Error('API Error'));

        const result = await service.processUserDescription('broken form');

        expect(result.enrichedDescription).toBe('broken form');
        expect(result.severity).toBe('medium');
      });
    });

    describe('classifyIssue', () => {
      it('should classify issue type', async () => {
        mockProvider.generateCompletion.mockResolvedValue('crash');

        const result = await service.classifyIssue('App crashes on startup');

        expect(result).toBe('crash');
      });

      it('should return other for unknown classification', async () => {
        mockProvider.generateCompletion.mockResolvedValue('something weird');

        const result = await service.classifyIssue('unknown issue');

        expect(result).toBe('other');
      });

      it('should return other on error', async () => {
        mockProvider.generateCompletion.mockRejectedValue(new Error('API Error'));

        const result = await service.classifyIssue('test');

        expect(result).toBe('other');
      });
    });

    describe('generateCompletion', () => {
      it('should generate completion', async () => {
        mockProvider.generateCompletion.mockResolvedValue('Generated response');

        const result = await service.generateCompletion('Summarize this');

        expect(result).toBe('Generated response');
      });

      it('should return empty string on error', async () => {
        mockProvider.generateCompletion.mockRejectedValue(new Error('API Error'));

        const result = await service.generateCompletion('test');

        expect(result).toBe('');
      });
    });
  });

  describe('when no AI provider is configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
          {
            provide: AIProviderFactory,
            useValue: {
              create: jest.fn(),
            },
          },
          {
            provide: PrismaService,
            useValue: {
              aiConfig: {
                findUnique: jest.fn().mockResolvedValue(null),
              },
              systemConfig: {
                upsert: jest.fn(),
              },
            },
          },
        ],
      }).compile();

      service = module.get<AIService>(AIService);
    });

    it('should return mock analysis', async () => {
      const result = await service.analyzeVideoTranscript('test');

      expect(result.severity).toBe('medium');
      expect(result.type).toBe('other');
    });

    it('should return other for classification', async () => {
      const result = await service.classifyIssue('test');

      expect(result).toBe('other');
    });

    it('should return empty string for completion', async () => {
      const result = await service.generateCompletion('test');

      expect(result).toBe('');
    });

    it('should return original description for processing', async () => {
      const result = await service.processUserDescription('original text');

      expect(result.enrichedDescription).toBe('original text');
    });
  });
});

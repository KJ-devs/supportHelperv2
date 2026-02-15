import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../../../src/ai/ai.service';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

describe('AIService', () => {
  let service: AIService;

  describe('when OpenAI is configured', () => {
    beforeEach(async () => {
      mockCreate.mockReset();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'OPENAI_API_KEY') return 'test-api-key';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<AIService>(AIService);
    });

    describe('analyzeVideoTranscript', () => {
      it('should analyze transcript and return result', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'Button not working',
                severity: 'high',
                severityConfidence: 0.9,
                type: 'bug',
                typeConfidence: 0.85,
                keywords: ['button', 'click'],
                reproductionSteps: ['Click submit'],
              }),
            },
          }],
        });

        const result = await service.analyzeVideoTranscript('The submit button does not work');

        expect(result.summary).toBe('Button not working');
        expect(result.severity).toBe('high');
        expect(result.type).toBe('bug');
        expect(result.keywords).toContain('button');
      });

      it('should handle markdown-wrapped JSON', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: '```json\n{"summary":"test","severity":"low","severityConfidence":0.5,"type":"other","typeConfidence":0.5,"keywords":[],"reproductionSteps":[]}\n```',
            },
          }],
        });

        const result = await service.analyzeVideoTranscript('test');

        expect(result.summary).toBe('test');
      });

      it('should return mock analysis on error', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        const result = await service.analyzeVideoTranscript('test transcript');

        expect(result.severity).toBe('medium');
        expect(result.type).toBe('other');
      });

      it('should include OCR text when provided', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'test', severity: 'medium', severityConfidence: 0.5,
                type: 'bug', typeConfidence: 0.5, keywords: [], reproductionSteps: [],
              }),
            },
          }],
        });

        await service.analyzeVideoTranscript('transcript', 'Error: null pointer');

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('Error: null pointer'),
              }),
            ]),
          }),
        );
      });
    });

    describe('processUserDescription', () => {
      it('should process and enrich user description', async () => {
        mockCreate.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                enrichedDescription: 'Enriched bug report',
                summary: 'Bug in form',
                severity: 'medium',
                severityConfidence: 0.7,
                type: 'bug',
                typeConfidence: 0.8,
                keywords: ['form', 'bug'],
                reproductionSteps: ['Open form', 'Submit'],
              }),
            },
          }],
        });

        const result = await service.processUserDescription('form is broken');

        expect(result.enrichedDescription).toBe('Enriched bug report');
        expect(result.summary).toBe('Bug in form');
      });

      it('should return fallback on error', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        const result = await service.processUserDescription('broken form');

        expect(result.enrichedDescription).toBe('broken form');
        expect(result.severity).toBe('medium');
      });
    });

    describe('classifyIssue', () => {
      it('should classify issue type', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'crash' } }],
        });

        const result = await service.classifyIssue('App crashes on startup');

        expect(result).toBe('crash');
      });

      it('should return other for unknown classification', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'something weird' } }],
        });

        const result = await service.classifyIssue('unknown issue');

        expect(result).toBe('other');
      });

      it('should return other on error', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        const result = await service.classifyIssue('test');

        expect(result).toBe('other');
      });
    });

    describe('generateCompletion', () => {
      it('should generate completion', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Generated response' } }],
        });

        const result = await service.generateCompletion('Summarize this');

        expect(result).toBe('Generated response');
      });

      it('should return empty string on error', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        const result = await service.generateCompletion('test');

        expect(result).toBe('');
      });

      it('should return empty string when content is null', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
        });

        const result = await service.generateCompletion('test');

        expect(result).toBe('');
      });
    });
  });

  describe('when OpenAI is NOT configured', () => {
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

import { Test, TestingModule } from '@nestjs/testing';
import { ResolutionSummaryService } from '../../../src/modules/tickets/services/resolution-summary.service';
import { AIService } from '../../../src/ai/ai.service';

describe('ResolutionSummaryService', () => {
  let service: ResolutionSummaryService;
  let aiService: AIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolutionSummaryService,
        {
          provide: AIService,
          useValue: {
            generateCompletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ResolutionSummaryService>(ResolutionSummaryService);
    aiService = module.get<AIService>(AIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateResolutionSummary', () => {
    const mockTicket = {
      id: 'ticket-123',
      title: 'Login button not working',
      description: 'User cannot click login button',
      type: 'bug',
      severity: 'high',
    };

    const mockPrDetails = {
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      branchName: 'fix/login-button',
    };

    it('should generate summary from AI response', async () => {
      const mockAIResponse = JSON.stringify({
        summary: 'Fixed the login button issue',
        changes: ['Updated button click handler', 'Added error logging'],
        version: 'v1.2.0',
      });

      jest.spyOn(aiService, 'generateCompletion').mockResolvedValue(mockAIResponse);

      const result = await service.generateResolutionSummary(mockTicket, mockPrDetails);

      expect(result.summary).toBe('Fixed the login button issue');
      expect(result.changes).toEqual(['Updated button click handler', 'Added error logging']);
      expect(result.version).toBe('v1.2.0');
      expect(aiService.generateCompletion).toHaveBeenCalledWith(
        expect.stringContaining('Login button not working'),
      );
    });

    it('should return fallback summary on AI failure', async () => {
      jest.spyOn(aiService, 'generateCompletion').mockResolvedValue('');

      const result = await service.generateResolutionSummary(mockTicket);

      expect(result.summary).toContain('Login button not working');
      expect(result.summary).toContain('has been fixed');
      expect(result.changes).toEqual(['The reported issue has been addressed']);
    });

    it('should handle invalid JSON response', async () => {
      jest.spyOn(aiService, 'generateCompletion').mockResolvedValue('Invalid JSON');

      const result = await service.generateResolutionSummary(mockTicket);

      expect(result.summary).toContain('has been fixed');
      expect(result.changes).toEqual(['The reported issue has been addressed']);
    });

    it('should work without PR details', async () => {
      const mockAIResponse = JSON.stringify({
        summary: 'Issue resolved',
        changes: ['Fixed'],
      });

      jest.spyOn(aiService, 'generateCompletion').mockResolvedValue(mockAIResponse);

      const result = await service.generateResolutionSummary(mockTicket);

      expect(result.summary).toBe('Issue resolved');
      expect(aiService.generateCompletion).toHaveBeenCalled();
    });
  });
});

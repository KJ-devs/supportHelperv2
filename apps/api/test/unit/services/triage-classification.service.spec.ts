import { Test, TestingModule } from '@nestjs/testing';
import {
  TriageClassificationService,
  TRIAGE_SYSTEM_PROMPT,
  TRIAGE_OUTPUT_SCHEMA,
} from '../../../src/modules/triage/triage-classification.service';
import { AIService } from '../../../src/ai/ai.service';
import { AiPromptConfigService } from '../../../src/modules/ai-config/ai-prompt-config.service';
import {
  TriageContext,
  TriageClassification,
  FeedbackCorrection,
} from '../../../src/modules/triage/interfaces/triage.interfaces';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<TriageContext['ticket']> = {}): TriageContext {
  return {
    ticket: {
      id: 'ticket-1',
      title: 'Test ticket',
      description: 'Test description',
      aiSummary: null,
      existingType: null,
      existingTypeConfidence: null,
      keywords: [],
      ...overrides,
    },
    userContext: null,
    videoAnalysis: null,
    codebaseMetadata: {
      hasIndexedCodebase: false,
      hasGithubConfig: false,
      repoName: null,
    },
    similarTickets: [],
    feedbackCorrections: [],
  };
}

function makeFullClassification(
  overrides: Partial<TriageClassification> = {}
): TriageClassification {
  return {
    type: 'bug',
    typeConfidence: 0.9,
    severity: 'high',
    severityConfidence: 0.85,
    summary: 'The login page crashes on submit',
    keywords: ['login', 'crash'],
    reasoning: 'User reported a crash with stack trace',
    isWorkingAsIntended: false,
    workingAsIntendedConfidence: 0.95,
    workingAsIntendedReasoning: 'Stack trace confirms an unhandled exception',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TriageClassificationService', () => {
  let service: TriageClassificationService;
  let mockProvider: { generateStructuredOutput: jest.Mock };
  let mockAiService: { getActiveProvider: jest.Mock };

  beforeEach(async () => {
    mockProvider = {
      generateStructuredOutput: jest.fn(),
    };

    mockAiService = {
      getActiveProvider: jest.fn().mockResolvedValue(mockProvider),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageClassificationService,
        { provide: AIService, useValue: mockAiService },
        {
          provide: AiPromptConfigService,
          useValue: {
            buildCustomInstructions: jest.fn().mockResolvedValue(''),
            getFeatureFlags: jest
              .fn()
              .mockResolvedValue({ enableTriage: true, enableN1: true, enableN2: true }),
            getAiTuningParams: jest.fn().mockResolvedValue({
              triageTemperature: 0.1,
              n1Temperature: 0.1,
              analysisTemperature: 0.3,
              maxIterationsN2: 15,
              timeoutN2: 120,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(TriageClassificationService);
  });

  // ── Prompt content ─────────────────────────────────────────────────────

  describe('TRIAGE_SYSTEM_PROMPT — bias removal', () => {
    it('does NOT contain "lean toward bug"', () => {
      expect(TRIAGE_SYSTEM_PROMPT).not.toMatch(/lean toward[s]? [""']?bug[""']?/i);
    });

    it('does NOT contain "lean towards bug"', () => {
      expect(TRIAGE_SYSTEM_PROMPT).not.toMatch(/lean towards [""']?bug[""']?/i);
    });

    it('does NOT say bug is the "safest default"', () => {
      expect(TRIAGE_SYSTEM_PROMPT).not.toMatch(/safest default/i);
    });
  });

  describe('TRIAGE_SYSTEM_PROMPT — nuanced classification rules', () => {
    it('instructs to lower typeConfidence below 0.7 when uncertain', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/typeConfidence.*0\.7|0\.7.*typeConfidence/);
    });

    it('describes behavior that is BROKEN maps to bug', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/BROKEN.*bug|crashes.*errors.*bug/is);
    });

    it('describes behavior that WORKS but unwanted maps to feature_request', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/WORKS.*feature_request|feature_request/is);
    });

    it('describes "how to" phrasing maps to question', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/how do I.*question|question.*how do I/is);
    });
  });

  describe('TRIAGE_SYSTEM_PROMPT — isWorkingAsIntended instructions', () => {
    it('contains isWorkingAsIntended instructions', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toContain('isWorkingAsIntended');
    });

    it('instructs to set isWorkingAsIntended=true for design decisions', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/isWorkingAsIntended=true/);
    });

    it('instructs to set isWorkingAsIntended=false for clear error signals', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/isWorkingAsIntended=false/);
    });

    it('instructs to use low confidence when intent is unclear', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toMatch(/low confidence|<0\.5/i);
    });
  });

  // ── Output schema ──────────────────────────────────────────────────────

  describe('TRIAGE_OUTPUT_SCHEMA — new fields present', () => {
    it('schema properties include isWorkingAsIntended', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.properties).toHaveProperty('isWorkingAsIntended');
    });

    it('isWorkingAsIntended is typed as boolean', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.properties.isWorkingAsIntended).toEqual({ type: 'boolean' });
    });

    it('schema properties include workingAsIntendedConfidence', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.properties).toHaveProperty('workingAsIntendedConfidence');
    });

    it('workingAsIntendedConfidence has minimum 0 and maximum 1', () => {
      const field = TRIAGE_OUTPUT_SCHEMA.properties.workingAsIntendedConfidence;
      expect(field).toMatchObject({ type: 'number', minimum: 0, maximum: 1 });
    });

    it('schema properties include workingAsIntendedReasoning', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.properties).toHaveProperty('workingAsIntendedReasoning');
    });

    it('workingAsIntendedReasoning is typed as string', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.properties.workingAsIntendedReasoning).toEqual({
        type: 'string',
      });
    });

    it('all three new fields are in required array', () => {
      expect(TRIAGE_OUTPUT_SCHEMA.required).toContain('isWorkingAsIntended');
      expect(TRIAGE_OUTPUT_SCHEMA.required).toContain('workingAsIntendedConfidence');
      expect(TRIAGE_OUTPUT_SCHEMA.required).toContain('workingAsIntendedReasoning');
    });
  });

  // ── Classification behavior (mocked AI) ───────────────────────────────

  describe('classify() — clear bug', () => {
    it('returns type=bug and isWorkingAsIntended=false for a crash/error scenario', async () => {
      const expected = makeFullClassification({
        type: 'bug',
        typeConfidence: 0.95,
        isWorkingAsIntended: false,
        workingAsIntendedConfidence: 0.9,
        workingAsIntendedReasoning: 'Stack trace confirms unhandled exception',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'App crashes on login',
        description:
          'I get a 500 error and the app crashes when I click submit. Stack trace: NullPointerException at line 42',
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.type).toBe('bug');
      expect(result.isWorkingAsIntended).toBe(false);
      expect(result.workingAsIntendedConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('classify() — clear feature request', () => {
    it('returns type=feature_request and isWorkingAsIntended=true when user wants new functionality', async () => {
      const expected = makeFullClassification({
        type: 'feature_request',
        typeConfidence: 0.92,
        severity: 'medium',
        isWorkingAsIntended: true,
        workingAsIntendedConfidence: 0.85,
        workingAsIntendedReasoning:
          'User is requesting a new export feature that does not exist yet',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'Can you add CSV export?',
        description:
          'I wish there was a way to export my data as a CSV file. Would be nice to have this feature.',
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.type).toBe('feature_request');
      expect(result.isWorkingAsIntended).toBe(true);
    });
  });

  describe('classify() — clear question', () => {
    it('returns type=question for "how do I" phrasing', async () => {
      const expected = makeFullClassification({
        type: 'question',
        typeConfidence: 0.88,
        severity: 'low',
        isWorkingAsIntended: true,
        workingAsIntendedConfidence: 0.7,
        workingAsIntendedReasoning: 'User is asking for documentation, not reporting a problem',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'How do I reset my password?',
        description: 'Where can I find the password reset option? What is the process?',
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.type).toBe('question');
    });
  });

  describe('classify() — ambiguous case', () => {
    it('returns typeConfidence below 0.7 for an ambiguous ticket', async () => {
      const expected = makeFullClassification({
        type: 'bug',
        typeConfidence: 0.55,
        isWorkingAsIntended: false,
        workingAsIntendedConfidence: 0.4,
        workingAsIntendedReasoning:
          'Cannot determine from available info whether this is a bug or design choice',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'Something is wrong',
        description: 'The app does not behave the way I expect.',
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.typeConfidence).toBeLessThan(0.7);
    });

    it('does NOT force type=bug for an ambiguous ticket (confidence is low, not overconfident)', async () => {
      const expected = makeFullClassification({
        type: 'bug',
        typeConfidence: 0.45,
        isWorkingAsIntended: false,
        workingAsIntendedConfidence: 0.3,
        workingAsIntendedReasoning: 'Insufficient information to determine intent',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'Ambiguous report',
        description: 'Not sure if this is expected behavior but it seems off.',
      });

      const result = await service.classify(ctx, 'tenant-1');

      // Confidence should be low — model should not be highly confident about type=bug
      expect(result.typeConfidence).toBeLessThan(0.7);
    });
  });

  describe('classify() — design decision', () => {
    it('returns isWorkingAsIntended=true with reasoning for a design-choice scenario', async () => {
      const expected = makeFullClassification({
        type: 'feature_request',
        typeConfidence: 0.8,
        isWorkingAsIntended: true,
        workingAsIntendedConfidence: 0.9,
        workingAsIntendedReasoning:
          'Access control restriction is a documented security design choice; user lacks required role',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'Cannot access admin panel',
        description:
          'I cannot see the admin panel but my colleague can. The page shows "Access Denied — requires Admin role".',
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.isWorkingAsIntended).toBe(true);
      expect(result.workingAsIntendedConfidence).toBeGreaterThan(0.5);
      expect(result.workingAsIntendedReasoning).toBeTruthy();
    });
  });

  describe('classify() — error messages in OCR', () => {
    it('returns isWorkingAsIntended=false when video OCR shows error messages', async () => {
      const expected = makeFullClassification({
        type: 'bug',
        typeConfidence: 0.93,
        isWorkingAsIntended: false,
        workingAsIntendedConfidence: 0.92,
        workingAsIntendedReasoning: 'OCR captured a 500 Internal Server Error message on screen',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const ctx = makeContext({
        title: 'Error on checkout',
        description: 'Something went wrong',
      });
      ctx.videoAnalysis = {
        ocrTexts: ['500 Internal Server Error', 'Something went wrong on our end'],
        visualCues: {
          errors: ['500 Internal Server Error'],
          urls: ['/api/checkout'],
          components: [],
        },
      };

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.isWorkingAsIntended).toBe(false);
    });
  });

  // ── Schema validation ──────────────────────────────────────────────────

  describe('classify() — schema validation', () => {
    it('parses a full response including all new fields correctly', async () => {
      const fullResponse = makeFullClassification();
      mockProvider.generateStructuredOutput.mockResolvedValue(fullResponse);

      const result = await service.classify(makeContext(), 'tenant-1');

      expect(result).toMatchObject({
        type: expect.stringMatching(/^(bug|feature_request|question)$/),
        typeConfidence: expect.any(Number),
        severity: expect.stringMatching(/^(critical|high|medium|low)$/),
        severityConfidence: expect.any(Number),
        summary: expect.any(String),
        keywords: expect.any(Array),
        reasoning: expect.any(String),
        isWorkingAsIntended: expect.any(Boolean),
        workingAsIntendedConfidence: expect.any(Number),
        workingAsIntendedReasoning: expect.any(String),
      });
    });

    it('new fields are present on the returned classification', async () => {
      const expected = makeFullClassification({
        isWorkingAsIntended: true,
        workingAsIntendedConfidence: 0.8,
        workingAsIntendedReasoning: 'Behavior is by design',
      });
      mockProvider.generateStructuredOutput.mockResolvedValue(expected);

      const result = await service.classify(makeContext(), 'tenant-1');

      expect(result).toHaveProperty('isWorkingAsIntended', true);
      expect(result).toHaveProperty('workingAsIntendedConfidence', 0.8);
      expect(result).toHaveProperty('workingAsIntendedReasoning', 'Behavior is by design');
    });
  });

  // ── Fallback (no AI provider) ──────────────────────────────────────────

  describe('classify() — fallback when no AI provider', () => {
    beforeEach(() => {
      mockAiService.getActiveProvider.mockResolvedValue(null);
    });

    it('returns a classification with all new fields populated', async () => {
      const result = await service.classify(makeContext(), 'tenant-1');

      expect(result).toHaveProperty('isWorkingAsIntended');
      expect(result).toHaveProperty('workingAsIntendedConfidence');
      expect(result).toHaveProperty('workingAsIntendedReasoning');
    });

    it('fallback with existing SDK type uses it and includes new fields', async () => {
      const ctx = makeContext({
        existingType: 'feature_request',
        existingTypeConfidence: 0.75,
      });

      const result = await service.classify(ctx, 'tenant-1');

      expect(result.type).toBe('feature_request');
      expect(result.typeConfidence).toBe(0.75);
      expect(result).toHaveProperty('isWorkingAsIntended', false);
      expect(result).toHaveProperty('workingAsIntendedConfidence', 0);
      expect(typeof result.workingAsIntendedReasoning).toBe('string');
    });

    it('fallback default returns typeConfidence=0.3 (low, not overconfident)', async () => {
      const result = await service.classify(makeContext(), 'tenant-1');

      expect(result.typeConfidence).toBe(0.3);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('classify() — error handling', () => {
    it('falls back to defaultClassification when provider throws', async () => {
      mockProvider.generateStructuredOutput.mockRejectedValue(new Error('API timeout'));

      const result = await service.classify(makeContext(), 'tenant-1');

      // Should not throw — returns default classification with new fields
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('isWorkingAsIntended');
      expect(result).toHaveProperty('workingAsIntendedConfidence');
      expect(result).toHaveProperty('workingAsIntendedReasoning');
    });
  });

  // ── Feedback corrections in prompt ─────────────────────────────────────

  describe('buildTriagePrompt — human corrections section', () => {
    function capturePrompt(): string {
      const calls = mockProvider.generateStructuredOutput.mock.calls;
      return calls[calls.length - 1][0] as string;
    }

    beforeEach(() => {
      mockProvider.generateStructuredOutput.mockResolvedValue(makeFullClassification());
    });

    it('includes Human Corrections section when feedbackCorrections are present', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-1',
        ticketTitle: 'Login button unresponsive',
        field: 'type',
        originalValue: 'bug',
        correctedValue: 'feature_request',
        reason: 'button is intentionally disabled until email verification',
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('## Human Corrections on Similar Tickets');
    });

    it('includes original and corrected values in the prompt', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-1',
        ticketTitle: 'Login button unresponsive',
        field: 'type',
        originalValue: 'bug',
        correctedValue: 'feature_request',
        reason: null,
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('"bug"');
      expect(prompt).toContain('"feature_request"');
    });

    it('includes ticket title in correction line', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-1',
        ticketTitle: 'Cannot export CSV',
        field: 'type',
        originalValue: 'bug',
        correctedValue: 'feature_request',
        reason: 'only JSON export is supported in v1',
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('"Cannot export CSV"');
    });

    it('includes reason in the correction line when present', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-1',
        ticketTitle: 'Some ticket',
        field: 'type',
        originalValue: 'bug',
        correctedValue: 'feature_request',
        reason: 'only JSON export is supported in v1',
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('only JSON export is supported in v1');
    });

    it('includes all corrections when multiple are present', async () => {
      const ctx = makeContext();
      ctx.feedbackCorrections = [
        {
          ticketId: 'similar-1',
          ticketTitle: 'Ticket A',
          field: 'type',
          originalValue: 'bug',
          correctedValue: 'feature_request',
          reason: null,
        },
        {
          ticketId: 'similar-2',
          ticketTitle: 'Ticket B',
          field: 'severity',
          originalValue: 'low',
          correctedValue: 'high',
          reason: null,
        },
      ];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('"Ticket A"');
      expect(prompt).toContain('"Ticket B"');
    });

    it('does NOT include Human Corrections section when feedbackCorrections is empty', async () => {
      const ctx = makeContext();
      ctx.feedbackCorrections = [];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).not.toContain('## Human Corrections on Similar Tickets');
    });

    it('works normally when feedbackCorrections is empty (no error thrown)', async () => {
      const ctx = makeContext();
      ctx.feedbackCorrections = [];

      const result = await service.classify(ctx, 'tenant-1');

      expect(result).toHaveProperty('type');
      expect(result.type).toBe('bug');
    });

    it('includes field name in correction line', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-1',
        ticketTitle: 'Login issue',
        field: 'severity',
        originalValue: 'low',
        correctedValue: 'critical',
        reason: null,
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('(severity)');
    });

    it('falls back to ticket ID in correction when title is null', async () => {
      const correction: FeedbackCorrection = {
        ticketId: 'similar-with-no-title',
        ticketTitle: null,
        field: 'type',
        originalValue: 'bug',
        correctedValue: 'question',
        reason: null,
      };

      const ctx = makeContext();
      ctx.feedbackCorrections = [correction];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toContain('similar-with-no-title');
    });

    it('instructs to weight recent corrections more heavily', async () => {
      const ctx = makeContext();
      ctx.feedbackCorrections = [
        {
          ticketId: 'similar-1',
          ticketTitle: 'Some ticket',
          field: 'type',
          originalValue: 'bug',
          correctedValue: 'feature_request',
          reason: null,
        },
      ];

      await service.classify(ctx, 'tenant-1');

      const prompt = capturePrompt();
      expect(prompt).toMatch(/[Ww]eight recent corrections/);
    });
  });
});

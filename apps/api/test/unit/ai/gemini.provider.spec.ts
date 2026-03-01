/**
 * Tests for GeminiProvider
 *
 * Mocks @google/generative-ai and openai at module level so no real API calls
 * are made during tests.
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be hoisted before any imports)
// ---------------------------------------------------------------------------

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const mockEmbeddingsCreate = jest.fn();
const mockOpenAIClient = {
  embeddings: {
    create: mockEmbeddingsCreate,
  },
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAIClient);
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GeminiProvider } from '../../../src/ai/providers/gemini.provider';
import { ServiceUnavailableException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextResponse(text: string) {
  return {
    response: {
      text: () => text,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let providerWithoutOpenAI: GeminiProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GeminiProvider('test-gemini-api-key', 'test-openai-api-key');
    providerWithoutOpenAI = new GeminiProvider('test-gemini-api-key');
  });

  // -------------------------------------------------------------------------
  // getProviderName
  // -------------------------------------------------------------------------

  describe('getProviderName()', () => {
    it('should return "gemini"', () => {
      expect(provider.getProviderName()).toBe('gemini');
    });
  });

  // -------------------------------------------------------------------------
  // generateCompletion
  // -------------------------------------------------------------------------

  describe('generateCompletion()', () => {
    it('should return text from Gemini response', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('Hello from Gemini'));

      const result = await provider.generateCompletion('Say hello');

      expect(result).toBe('Hello from Gemini');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          generationConfig: expect.objectContaining({
            temperature: 0.7,
            maxOutputTokens: 1500,
          }),
        }),
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([{ text: 'Say hello' }]),
      );
    });

    it('should use custom model from options', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('ok'));

      await provider.generateCompletion('prompt', { model: 'gemini-1.5-pro' });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-1.5-pro' }),
      );
    });

    it('should include systemPrompt as systemInstruction', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('ok'));

      await provider.generateCompletion('prompt', { systemPrompt: 'You are a tester' });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'You are a tester',
        }),
      );
    });

    it('should include images as inlineData parts', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('ok'));

      await provider.generateCompletion('describe this image', {
        images: [{ data: 'base64data==', mimeType: 'image/jpeg' }],
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          { text: 'describe this image' },
          { inlineData: { data: 'base64data==', mimeType: 'image/jpeg' } },
        ]),
      );
    });

    it('should propagate errors thrown by Gemini', async () => {
      const apiError = new Error('Gemini API error');
      mockGenerateContent.mockRejectedValueOnce(apiError);

      await expect(provider.generateCompletion('prompt')).rejects.toThrow('Gemini API error');
    });
  });

  // -------------------------------------------------------------------------
  // generateStructuredOutput
  // -------------------------------------------------------------------------

  describe('generateStructuredOutput()', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };

    it('should parse JSON from Gemini response', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeTextResponse('{"name":"Alice"}'),
      );

      const result = await provider.generateStructuredOutput<{ name: string }>(
        'get name',
        schema,
      );

      expect(result).toEqual({ name: 'Alice' });
    });

    it('should use JSON response mode (responseMimeType: application/json)', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('{"ok":true}'));

      await provider.generateStructuredOutput('prompt', schema);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        }),
      );
    });

    it('should extract JSON even when wrapped in markdown code blocks', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeTextResponse('```json\n{"status":"ok"}\n```'),
      );

      const result = await provider.generateStructuredOutput<{ status: string }>(
        'prompt',
        schema,
      );

      expect(result).toEqual({ status: 'ok' });
    });

    it('should throw ServiceUnavailableException on empty response', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse(''));

      await expect(
        provider.generateStructuredOutput('prompt', schema),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should throw ServiceUnavailableException when no JSON found', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeTextResponse('This is not JSON at all'),
      );

      await expect(
        provider.generateStructuredOutput('prompt', schema),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should include images as inlineData parts for vision tasks', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('{"label":"cat"}'));

      await provider.generateStructuredOutput<{ label: string }>('classify', schema, {
        images: [
          { data: 'imagebase64==', mimeType: 'image/png' },
        ],
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          { inlineData: { data: 'imagebase64==', mimeType: 'image/png' } },
        ]),
      );
    });

    it('should use custom systemPrompt when provided', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('{"ok":true}'));

      await provider.generateStructuredOutput('prompt', schema, {
        systemPrompt: 'Custom system prompt',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'Custom system prompt',
        }),
      );
    });

    it('should propagate errors thrown by Gemini', async () => {
      const apiError = new Error('Rate limit exceeded');
      mockGenerateContent.mockRejectedValueOnce(apiError);

      await expect(
        provider.generateStructuredOutput('prompt', schema),
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // generateEmbedding
  // -------------------------------------------------------------------------

  describe('generateEmbedding()', () => {
    it('should delegate to OpenAI text-embedding-3-small', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await provider.generateEmbedding('some text');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'some text',
      });
    });

    it('should truncate text longer than 32000 characters before embedding', async () => {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.5] }],
      });

      const longText = 'a'.repeat(40000);
      await provider.generateEmbedding(longText);

      const calledWith = mockEmbeddingsCreate.mock.calls[0][0];
      expect(calledWith.input.length).toBe(32000);
    });

    it('should return empty array when OpenAI client is not available', async () => {
      const result = await providerWithoutOpenAI.generateEmbedding('some text');

      expect(result).toEqual([]);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('should return empty array on OpenAI embedding error', async () => {
      mockEmbeddingsCreate.mockRejectedValueOnce(new Error('API error'));

      const result = await provider.generateEmbedding('some text');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // validateConfig
  // -------------------------------------------------------------------------

  describe('validateConfig()', () => {
    it('should return true when Gemini API call succeeds', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('pong'));

      const result = await provider.validateConfig();

      expect(result).toBe(true);
    });

    it('should return false when Gemini API call fails', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await provider.validateConfig();

      expect(result).toBe(false);
    });

    it('should use the default model for validation ping', async () => {
      mockGenerateContent.mockResolvedValueOnce(makeTextResponse('ok'));

      await provider.validateConfig();

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.0-flash' }),
      );
    });
  });
});

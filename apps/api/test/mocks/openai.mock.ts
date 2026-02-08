/**
 * OpenAI Mock for Testing
 *
 * Provides mock implementations of OpenAI API calls.
 */

import { vi } from 'vitest';

export interface MockChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MockChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Default mock responses for different scenarios
export const mockResponses = {
  classification: JSON.stringify({
    type: 'bug',
    typeConfidence: 0.92,
    severity: 'medium',
    severityConfidence: 0.85,
    summary: 'User reports an issue with button functionality',
    keywords: ['button', 'click', 'not working'],
  }),

  summary:
    'The user is experiencing an issue where the submit button on the form does not respond to clicks. This appears to be a UI bug that prevents form submission.',

  analysis: JSON.stringify({
    category: 'ui',
    component: 'form',
    possibleCauses: ['Event handler not attached', 'Button disabled state', 'JavaScript error'],
    suggestedFix:
      'Check browser console for JavaScript errors and verify the onClick handler is properly attached.',
  }),
};

// Mock OpenAI client
export const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi
        .fn()
        .mockImplementation(async (params: { messages: MockChatMessage[]; model: string }) => {
          // Determine response based on message content
          const lastMessage = params.messages[params.messages.length - 1];
          let responseContent = mockResponses.summary;

          if (lastMessage.content.toLowerCase().includes('classify')) {
            responseContent = mockResponses.classification;
          } else if (lastMessage.content.toLowerCase().includes('analyz')) {
            responseContent = mockResponses.analysis;
          }

          const response: MockChatCompletionResponse = {
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: params.model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: responseContent,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          };

          return response;
        }),
    },
  },

  embeddings: {
    create: vi
      .fn()
      .mockImplementation(async (params: { input: string | string[]; model: string }) => {
        const inputs = Array.isArray(params.input) ? params.input : [params.input];

        return {
          object: 'list',
          data: inputs.map((_, index) => ({
            object: 'embedding',
            index,
            embedding: Array(1536)
              .fill(0)
              .map(() => Math.random() * 2 - 1),
          })),
          model: params.model,
          usage: {
            prompt_tokens: inputs.length * 10,
            total_tokens: inputs.length * 10,
          },
        };
      }),
  },
};

// Reset function for tests
export function resetOpenAIMocks() {
  mockOpenAIClient.chat.completions.create.mockClear();
  mockOpenAIClient.embeddings.create.mockClear();
}

// Set custom response for specific tests
export function setMockResponse(responseType: keyof typeof mockResponses, content: string) {
  mockResponses[responseType] = content;
}

// Factory function for Jest mocking
export function createMockOpenAI() {
  return vi.fn().mockImplementation(() => mockOpenAIClient);
}

// Error simulation helpers
export function simulateRateLimitError() {
  mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(
    Object.assign(new Error('Rate limit exceeded'), {
      status: 429,
      code: 'rate_limit_exceeded',
    })
  );
}

export function simulateAPIError(message = 'API Error', status = 500) {
  mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(
    Object.assign(new Error(message), { status })
  );
}

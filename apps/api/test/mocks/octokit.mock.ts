/**
 * Mock for @octokit/rest and @octokit/core
 * Used in E2E tests to avoid ESM compatibility issues
 */

export class Octokit {
  constructor(_options?: any) {}

  rest = {
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({
        data: {
          id: 12345,
          login: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        },
      }),
    },
    repos: {
      get: jest.fn().mockResolvedValue({ data: {} }),
      listForAuthenticatedUser: jest.fn().mockResolvedValue({ data: [] }),
    },
    issues: {
      create: jest.fn().mockResolvedValue({
        data: {
          id: 1,
          number: 1,
          html_url: 'https://github.com/test/repo/issues/1',
        },
      }),
      update: jest.fn().mockResolvedValue({ data: {} }),
      get: jest.fn().mockResolvedValue({ data: {} }),
    },
  };

  auth = jest.fn().mockResolvedValue({ token: 'mock-token' });
}

export default { Octokit };

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Server for Node.js (Vitest)
 *
 * This server intercepts HTTP requests during tests.
 */
export const server = setupServer(...handlers);

// Start server before all tests
export function setupMSW() {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'warn' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}

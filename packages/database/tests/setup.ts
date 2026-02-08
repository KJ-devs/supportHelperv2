import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup for database package

beforeAll(async () => {
  // Setup before all tests
  console.log('🧪 Starting database tests...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('✅ Database tests complete');
});

beforeEach(() => {
  // Reset mocks between tests
});

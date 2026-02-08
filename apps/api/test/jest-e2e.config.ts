import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // E2E specific patterns
  testMatch: ['<rootDir>/e2e/**/*.e2e-spec.ts'],

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@test/(.*)$': '<rootDir>/$1',
    // Mock ESM-only packages
    '^@octokit/rest$': '<rootDir>/mocks/octokit.mock.ts',
    '^@octokit/core$': '<rootDir>/mocks/octokit.mock.ts',
  },

  // Transform
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],

  // Longer timeout for E2E
  testTimeout: 120000,

  // Run tests sequentially
  maxWorkers: 1,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
};

export default config;

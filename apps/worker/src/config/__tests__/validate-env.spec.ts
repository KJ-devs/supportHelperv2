/**
 * Worker Environment Variable Validation Tests
 *
 * Tests for the pre-bootstrap environment validation logic in worker
 */

import { validateEnvironmentVariables } from '../validate-env';

describe('Worker Environment Variable Validation', () => {
  // Save original environment
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment after all tests
    process.env = { ...originalEnv };
  });

  describe('Missing Required Variables', () => {
    it('should throw error when OPENAI_API_KEY is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironmentVariables()).toThrow(/OPENAI_API_KEY/);
      expect(() => validateEnvironmentVariables()).toThrow(/Missing or invalid required environment variables/);
    });

    it('should throw error when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;

      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
    });

    it('should throw error when REDIS_URL is missing', () => {
      delete process.env.REDIS_URL;

      expect(() => validateEnvironmentVariables()).toThrow(/REDIS_URL/);
    });
  });

  describe('Invalid Variable Values', () => {
    it('should throw error when OPENAI_API_KEY does not start with sk-', () => {
      process.env.OPENAI_API_KEY = 'invalid-key-12345';

      expect(() => validateEnvironmentVariables()).toThrow(/OPENAI_API_KEY/);
      expect(() => validateEnvironmentVariables()).toThrow(/platform.openai.com/);
    });

    it('should throw error when JWT_SECRET is an insecure default', () => {
      process.env.JWT_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when WORKER_PORT is not a number', () => {
      // Set all required variables first
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY_ID = 'minioadmin';
      process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      // Now set the invalid WORKER_PORT
      process.env.WORKER_PORT = 'not-a-number';

      expect(() => validateEnvironmentVariables()).toThrow(/WORKER_PORT/);
    });

    it('should throw error when WORKER_CONCURRENCY is not a number', () => {
      // Set all required variables first
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY_ID = 'minioadmin';
      process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      // Now set the invalid WORKER_CONCURRENCY
      process.env.WORKER_CONCURRENCY = 'not-a-number';

      expect(() => validateEnvironmentVariables()).toThrow(/WORKER_CONCURRENCY/);
    });
  });

  describe('Valid Configurations', () => {
    it('should pass validation with all valid environment variables', () => {
      // Set all required variables to valid values
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY_ID = 'minioadmin';
      process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid WORKER_PORT number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY_ID = 'minioadmin';
      process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      process.env.WORKER_PORT = '3003';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid WORKER_CONCURRENCY number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY_ID = 'minioadmin';
      process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      process.env.WORKER_CONCURRENCY = '10';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });

  describe('Error Message Format', () => {
    it('should include helpful setup hints in error message', () => {
      delete process.env.OPENAI_API_KEY;

      try {
        validateEnvironmentVariables();
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Worker Environment Variable Validation Failed');
        expect(error.message).toContain('OPENAI_API_KEY');
        expect(error.message).toContain('platform.openai.com');
        expect(error.message).toContain('.env.local');
        expect(error.message).toContain('Worker startup aborted');
      }
    });
  });
});

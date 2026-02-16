/**
 * Environment Variable Validation Tests
 *
 * Tests for the pre-bootstrap environment validation logic
 */

import { validateEnvironmentVariables } from '../../../src/config/validate-env';

describe('Environment Variable Validation', () => {
  // Save original environment
  const originalEnv = { ...process.env };

  /** Helper: set all required env vars to valid values */
  function setAllRequired() {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
    process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_ACCESS_KEY = 'minioadmin';
    process.env.S3_SECRET_KEY = 'minioadmin';
    process.env.S3_BUCKET = 'videos';
    process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
    process.env.ENCRYPTION_KEY = 'c4b62c7ab982d75f2be8bbdce2b1f91d9ac997db1c66ef86196e5af7da5ba6f1';
  }

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment after all tests
    process.env = { ...originalEnv };
  });

  describe('Missing Required Variables', () => {
    it('should throw error when DATABASE_URL is missing', () => {
      setAllRequired();
      delete process.env.DATABASE_URL;

      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
    });

    it('should throw error when REDIS_URL is missing', () => {
      setAllRequired();
      delete process.env.REDIS_URL;

      expect(() => validateEnvironmentVariables()).toThrow(/REDIS_URL/);
    });

    it('should throw error when S3_ENDPOINT is missing', () => {
      setAllRequired();
      delete process.env.S3_ENDPOINT;

      expect(() => validateEnvironmentVariables()).toThrow(/S3_ENDPOINT/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is missing', () => {
      setAllRequired();
      delete process.env.INTEGRATION_ENCRYPTION_KEY;

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when ENCRYPTION_KEY is missing', () => {
      setAllRequired();
      delete process.env.ENCRYPTION_KEY;

      expect(() => validateEnvironmentVariables()).toThrow(/ENCRYPTION_KEY/);
    });
  });

  describe('Optional AI Provider Keys', () => {
    it('should pass validation without ANTHROPIC_API_KEY', () => {
      setAllRequired();
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should pass validation without OPENAI_API_KEY', () => {
      setAllRequired();
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should pass validation without either AI key', () => {
      setAllRequired();
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });

  describe('Invalid Variable Values', () => {
    it('should throw error when JWT_SECRET is an insecure default', () => {
      setAllRequired();
      process.env.JWT_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is another insecure default', () => {
      setAllRequired();
      process.env.JWT_SECRET = 'change-me';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is the example default', () => {
      setAllRequired();
      process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is too short', () => {
      setAllRequired();
      process.env.JWT_SECRET = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
      expect(() => validateEnvironmentVariables()).toThrow(/openssl rand -hex 32/);
    });

    it('should throw error when JWT_REFRESH_SECRET is an insecure default', () => {
      setAllRequired();
      process.env.JWT_REFRESH_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('should throw error when JWT_REFRESH_SECRET is too short', () => {
      setAllRequired();
      process.env.JWT_REFRESH_SECRET = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is not 64 hex characters', () => {
      setAllRequired();
      process.env.INTEGRATION_ENCRYPTION_KEY = 'notvalidhex';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is too short', () => {
      setAllRequired();
      process.env.INTEGRATION_ENCRYPTION_KEY = 'abc123';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when API_PORT is not a number', () => {
      setAllRequired();
      process.env.API_PORT = 'not-a-number';

      expect(() => validateEnvironmentVariables()).toThrow(/API_PORT/);
    });
  });

  describe('Valid Configurations', () => {
    it('should pass validation with all valid environment variables', () => {
      setAllRequired();

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid API_PORT number', () => {
      setAllRequired();
      process.env.API_PORT = '3001';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid INTEGRATION_ENCRYPTION_KEY with uppercase hex', () => {
      setAllRequired();
      process.env.INTEGRATION_ENCRYPTION_KEY = 'B3A51B69A871C64E1AF7AACBF1A0E80C89C886CA0B55DE75095F49E6C94A95E0';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });

  describe('Error Message Format', () => {
    it('should include helpful setup hints in error message', () => {
      setAllRequired();
      delete process.env.DATABASE_URL;

      expect(() => validateEnvironmentVariables()).toThrow(/Environment Variable Validation Failed/);
      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
      expect(() => validateEnvironmentVariables()).toThrow(/\.env\.local/);
    });

    it('should show multiple validation errors together', () => {
      setAllRequired();
      delete process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });
  });

  describe('Edge Cases', () => {
    it('should treat empty string as missing variable', () => {
      setAllRequired();
      process.env.DATABASE_URL = '';

      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
    });

    it('should treat whitespace-only string as missing variable', () => {
      setAllRequired();
      process.env.DATABASE_URL = '   ';

      expect(() => validateEnvironmentVariables()).toThrow(/DATABASE_URL/);
    });
  });
});

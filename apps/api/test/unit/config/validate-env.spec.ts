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
    process.env.S3_ACCESS_KEY_ID = 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
    process.env.S3_BUCKET = 'videos';
    process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
    process.env.ENCRYPTION_KEY = 'c4b62c7ab982d75f2be8bbdce2b1f91d9ac997db1c66ef86196e5af7da5ba6f1';
    process.env.INTERNAL_API_SECRET = 'internal-secret-key-for-worker-to-api-calls-min-32';
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

    it('should throw error when S3_ENDPOINT is missing', () => {
      delete process.env.S3_ENDPOINT;

      expect(() => validateEnvironmentVariables()).toThrow(/S3_ENDPOINT/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is missing', () => {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when ENCRYPTION_KEY is missing', () => {
      setAllRequired();
      delete process.env.ENCRYPTION_KEY;

      expect(() => validateEnvironmentVariables()).toThrow(/ENCRYPTION_KEY/);
    });

    it('should throw error when INTERNAL_API_SECRET is missing', () => {
      setAllRequired();
      delete process.env.INTERNAL_API_SECRET;

      expect(() => validateEnvironmentVariables()).toThrow(/INTERNAL_API_SECRET/);
    });

    it('should throw error when INTERNAL_API_SECRET is too short (< 32 chars)', () => {
      setAllRequired();
      process.env.INTERNAL_API_SECRET = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/INTERNAL_API_SECRET/);
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
    it('should throw error when OPENAI_API_KEY does not start with sk-', () => {
      process.env.OPENAI_API_KEY = 'invalid-key-12345';

      expect(() => validateEnvironmentVariables()).toThrow(/OPENAI_API_KEY/);
      expect(() => validateEnvironmentVariables()).toThrow(/platform.openai.com/);
    });

    it('should throw error when JWT_SECRET is an insecure default', () => {
      process.env.JWT_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is another insecure default', () => {
      process.env.JWT_SECRET = 'change-me';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is the example default', () => {
      process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
    });

    it('should throw error when JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_SECRET/);
      expect(() => validateEnvironmentVariables()).toThrow(/openssl rand -hex 32/);
    });

    it('should throw error when JWT_REFRESH_SECRET is an insecure default', () => {
      process.env.JWT_REFRESH_SECRET = 'secret';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('should throw error when JWT_REFRESH_SECRET is too short', () => {
      process.env.JWT_REFRESH_SECRET = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is not 64 hex characters', () => {
      process.env.INTEGRATION_ENCRYPTION_KEY = 'notvalidhex';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when INTEGRATION_ENCRYPTION_KEY is too short', () => {
      process.env.INTEGRATION_ENCRYPTION_KEY = 'abc123';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw error when API_PORT is not a number', () => {
      // Set all required variables first
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      // Now set the invalid API_PORT
      process.env.API_PORT = 'not-a-number';

      expect(() => validateEnvironmentVariables()).toThrow(/API_PORT/);
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
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid API_PORT number', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';
      process.env.API_PORT = '3001';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid INTEGRATION_ENCRYPTION_KEY with uppercase hex', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'B3A51B69A871C64E1AF7AACBF1A0E80C89C886CA0B55DE75095F49E6C94A95E0';

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
        expect(error.message).toContain('Environment Variable Validation Failed');
        expect(error.message).toContain('OPENAI_API_KEY');
        expect(error.message).toContain('platform.openai.com');
        expect(error.message).toContain('.env.local');
      }
    });

    it('should show multiple validation errors together', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.DATABASE_URL;
      process.env.JWT_SECRET = 'secret';

      try {
        validateEnvironmentVariables();
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('OPENAI_API_KEY');
        expect(error.message).toContain('DATABASE_URL');
        expect(error.message).toContain('JWT_SECRET');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should treat empty string as missing variable', () => {
      process.env.OPENAI_API_KEY = '';

      expect(() => validateEnvironmentVariables()).toThrow(/OPENAI_API_KEY/);
    });

    it('should treat whitespace-only string as missing variable', () => {
      process.env.OPENAI_API_KEY = '   ';

      expect(() => validateEnvironmentVariables()).toThrow(/OPENAI_API_KEY/);
    });

    it('should accept OPENAI_API_KEY starting with sk-proj-', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
      process.env.JWT_REFRESH_SECRET = 'z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1';
      process.env.OPENAI_API_KEY = 'sk-proj-abc123';
      process.env.S3_ENDPOINT = 'http://localhost:9000';
      process.env.S3_ACCESS_KEY = 'minioadmin';
      process.env.S3_SECRET_KEY = 'minioadmin';
      process.env.S3_BUCKET = 'videos';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });

  describe('Production Encryption Key Enforcement', () => {
    it('should throw when ENCRYPTION_KEY is empty (production)', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.ENCRYPTION_KEY = '';

      expect(() => validateEnvironmentVariables()).toThrow(/ENCRYPTION_KEY/);
    });

    it('should throw when ENCRYPTION_KEY is too short (not 64 hex chars)', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => validateEnvironmentVariables()).toThrow(/ENCRYPTION_KEY/);
    });

    it('should throw when INTEGRATION_ENCRYPTION_KEY is empty (production)', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.INTEGRATION_ENCRYPTION_KEY = '';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should throw when INTEGRATION_ENCRYPTION_KEY is too short (not 64 hex chars)', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'abc123';

      expect(() => validateEnvironmentVariables()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });

    it('should accept valid 64-char hex ENCRYPTION_KEY in production', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.ENCRYPTION_KEY = 'c4b62c7ab982d75f2be8bbdce2b1f91d9ac997db1c66ef86196e5af7da5ba6f1';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    it('should accept valid 64-char hex INTEGRATION_ENCRYPTION_KEY in production', () => {
      setAllRequired();
      process.env.NODE_ENV = 'production';
      process.env.INTEGRATION_ENCRYPTION_KEY = 'b3a51b69a871c64e1af7aacbf1a0e80c89c886ca0b55de75095f49e6c94a95e0';

      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });
});

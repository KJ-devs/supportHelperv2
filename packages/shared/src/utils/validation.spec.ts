import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUUID,
  isValidSlug,
  generateSlug,
  generateSDKKey,
  sanitizeFilename,
  formatBytes,
  formatDuration,
} from './validation';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user name@domain.com')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-62d3-a456-426614174000')).toBe(false); // Invalid version
      expect(isValidUUID('123e4567-e89b-12d3-7456-426614174000')).toBe(false); // Invalid variant
      expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false); // No dashes
    });
  });

  describe('isValidSlug', () => {
    it('should return true for valid slugs', () => {
      expect(isValidSlug('hello-world')).toBe(true);
      expect(isValidSlug('my-app')).toBe(true);
      expect(isValidSlug('test123')).toBe(true);
      expect(isValidSlug('a-b-c')).toBe(true);
    });

    it('should return false for invalid slugs', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('ab')).toBe(false); // Too short
      expect(isValidSlug('Hello-World')).toBe(false); // Uppercase
      expect(isValidSlug('hello_world')).toBe(false); // Underscore
      expect(isValidSlug('hello--world')).toBe(false); // Double dash
      expect(isValidSlug('-hello')).toBe(false); // Starts with dash
      expect(isValidSlug('hello-')).toBe(false); // Ends with dash
    });

    it('should reject slugs that are too long', () => {
      const longSlug = 'a'.repeat(51);
      expect(isValidSlug(longSlug)).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('should generate valid slugs from names', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('My App')).toBe('my-app');
      expect(generateSlug('Test 123')).toBe('test-123');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Hello & World!')).toBe('hello-world');
      expect(generateSlug('App@v2.0')).toBe('app-v2-0');
      expect(generateSlug('Test---Multiple')).toBe('test-multiple');
    });

    it('should remove leading and trailing dashes', () => {
      expect(generateSlug('  Hello World  ')).toBe('hello-world');
      expect(generateSlug('---test---')).toBe('test');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(100);
      const slug = generateSlug(longName);
      expect(slug.length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateSDKKey', () => {
    it('should generate keys with correct prefix', () => {
      const key = generateSDKKey();
      expect(key.startsWith('sk_')).toBe(true);
    });

    it('should generate keys of correct length', () => {
      const key = generateSDKKey();
      expect(key.length).toBe(35); // 'sk_' + 32 characters
    });

    it('should generate unique keys', () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(generateSDKKey());
      }
      expect(keys.size).toBe(100);
    });

    it('should only contain alphanumeric characters after prefix', () => {
      const key = generateSDKKey();
      const suffix = key.slice(3);
      expect(/^[A-Za-z0-9]+$/.test(suffix)).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should keep valid characters', () => {
      expect(sanitizeFilename('file.txt')).toBe('file.txt');
      expect(sanitizeFilename('my-file_v1.0.pdf')).toBe('my-file_v1.0.pdf');
    });

    it('should replace invalid characters with underscores', () => {
      expect(sanitizeFilename('file name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file@v2!.txt')).toBe('file_v2_.txt');
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFilename('file   name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('test!!!file.txt')).toBe('test_file.txt');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(500)).toBe('500 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds to mm:ss', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30000)).toBe('0:30');
      expect(formatDuration(60000)).toBe('1:00');
      expect(formatDuration(90000)).toBe('1:30');
      expect(formatDuration(125000)).toBe('2:05');
    });

    it('should format to hh:mm:ss for durations over an hour', () => {
      expect(formatDuration(3600000)).toBe('1:00:00');
      expect(formatDuration(3661000)).toBe('1:01:01');
      expect(formatDuration(7325000)).toBe('2:02:05');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { encryptAES256GCM, decryptAES256GCM, parseEncryptionKey } from './encryption';

describe('Encryption utilities', () => {
  describe('parseEncryptionKey', () => {
    it('should parse valid 64-char hex key', () => {
      const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const key = parseEncryptionKey(keyHex);

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should throw error for key that is too short', () => {
      const keyHex = '0123456789abcdef';

      expect(() => parseEncryptionKey(keyHex)).toThrow(
        'Encryption key must be 32 bytes (64 hex chars)'
      );
    });

    it('should throw error for key that is too long', () => {
      const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00';

      expect(() => parseEncryptionKey(keyHex)).toThrow(
        'Encryption key must be 32 bytes (64 hex chars)'
      );
    });
  });

  describe('encryptAES256GCM and decryptAES256GCM', () => {
    const keyHex = 'a'.repeat(64); // 32 bytes
    const key = parseEncryptionKey(keyHex);

    it('should encrypt and decrypt plaintext correctly', () => {
      const plaintext = 'Hello, World!';

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);
      const decrypted = decryptAES256GCM(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'Hello, World!';

      const result1 = encryptAES256GCM(plaintext, key);
      const result2 = encryptAES256GCM(plaintext, key);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.iv).not.toBe(result2.iv);

      // Both should decrypt to the same plaintext
      expect(decryptAES256GCM(result1.ciphertext, result1.iv, key)).toBe(plaintext);
      expect(decryptAES256GCM(result2.ciphertext, result2.iv, key)).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON correctly', () => {
      const data = { apiKey: 'secret123', domain: 'example.com' };
      const plaintext = JSON.stringify(data);

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);
      const decrypted = decryptAES256GCM(ciphertext, iv, key);

      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should encrypt and decrypt empty string', () => {
      const plaintext = '';

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);
      const decrypted = decryptAES256GCM(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt long text', () => {
      const plaintext = 'Lorem ipsum dolor sit amet, '.repeat(100);

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);
      const decrypted = decryptAES256GCM(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting with wrong key', () => {
      const plaintext = 'Hello, World!';
      const wrongKey = parseEncryptionKey('b'.repeat(64));

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);

      expect(() => decryptAES256GCM(ciphertext, iv, wrongKey)).toThrow();
    });

    it('should throw error when decrypting with wrong IV', () => {
      const plaintext = 'Hello, World!';
      const wrongIv = '0'.repeat(32);

      const { ciphertext } = encryptAES256GCM(plaintext, key);

      expect(() => decryptAES256GCM(ciphertext, wrongIv, key)).toThrow();
    });

    it('should throw error when ciphertext is tampered', () => {
      const plaintext = 'Hello, World!';

      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);
      const tampered = ciphertext.slice(0, -2) + '00';

      expect(() => decryptAES256GCM(tampered, iv, key)).toThrow();
    });
  });

  describe('Integration test - API and Worker compatibility', () => {
    it('should encrypt in API service format and decrypt in Worker format', () => {
      // Simulate API encryption
      const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const key = parseEncryptionKey(keyHex);

      const config = {
        apiKey: 'jira-secret-key',
        domain: 'company.atlassian.net',
        projectKey: 'SUP',
      };

      const plaintext = JSON.stringify(config);

      // API encrypts
      const { ciphertext, iv } = encryptAES256GCM(plaintext, key);

      // Worker decrypts
      const decrypted = decryptAES256GCM(ciphertext, iv, key);
      const parsed = JSON.parse(decrypted);

      expect(parsed).toEqual(config);
    });
  });
});

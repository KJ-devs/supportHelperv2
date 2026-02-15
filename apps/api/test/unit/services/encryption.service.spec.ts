import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../../src/common/services/encryption.service';
import { randomBytes } from 'crypto';

describe('EncryptionService', () => {
  const VALID_KEY = randomBytes(32).toString('hex');

  function createConfigService(keyValue?: string | null): Partial<ConfigService> {
    return {
      get: jest.fn((key: string) => {
        if (key === 'ENCRYPTION_KEY') return keyValue;
        return undefined;
      }),
    };
  }

  async function buildService(keyValue?: string | null): Promise<EncryptionService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: createConfigService(keyValue),
        },
      ],
    }).compile();

    const service = module.get<EncryptionService>(EncryptionService);
    service.onModuleInit();
    return service;
  }

  describe('initialization', () => {
    it('should initialize with a valid 32-byte hex key', async () => {
      const service = await buildService(VALID_KEY);
      expect(service).toBeDefined();
    });

    it('should throw if ENCRYPTION_KEY is missing', async () => {
      await expect(buildService(undefined)).rejects.toThrow(
        'ENCRYPTION_KEY is not configured',
      );
    });

    it('should throw if ENCRYPTION_KEY is empty string', async () => {
      await expect(buildService('')).rejects.toThrow(
        'ENCRYPTION_KEY is not configured',
      );
    });

    it('should throw if ENCRYPTION_KEY is not 32 bytes', async () => {
      const shortKey = randomBytes(16).toString('hex'); // 16 bytes = 32 hex chars
      await expect(buildService(shortKey)).rejects.toThrow(
        'ENCRYPTION_KEY must be exactly 32 bytes',
      );
    });

    it('should throw if ENCRYPTION_KEY is too long', async () => {
      const longKey = randomBytes(48).toString('hex'); // 48 bytes = 96 hex chars
      await expect(buildService(longKey)).rejects.toThrow(
        'ENCRYPTION_KEY must be exactly 32 bytes',
      );
    });
  });

  describe('encrypt and decrypt', () => {
    let service: EncryptionService;

    beforeAll(async () => {
      service = await buildService(VALID_KEY);
    });

    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON data', () => {
      const data = JSON.stringify({ apiKey: 'sk-123', secret: 'abc' });
      const encrypted = service.encrypt(data);
      const decrypted = service.decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual({ apiKey: 'sk-123', secret: 'abc' });
    });

    it('should encrypt and decrypt empty string', () => {
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should encrypt and decrypt unicode characters', () => {
      const plaintext = 'Hello \u{1F600} \u00E9\u00E8\u00EA \u4F60\u597D';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce format iv:authTag:ciphertext', () => {
      const encrypted = service.encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // Each part should be valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      }
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same input';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('decrypt error handling', () => {
    let service: EncryptionService;

    beforeAll(async () => {
      service = await buildService(VALID_KEY);
    });

    it('should throw on invalid payload format (no colons)', () => {
      expect(() => service.decrypt('not-valid')).toThrow(
        'Invalid encrypted payload format',
      );
    });

    it('should throw on payload with wrong number of parts', () => {
      expect(() => service.decrypt('a:b')).toThrow(
        'Invalid encrypted payload format',
      );
      expect(() => service.decrypt('a:b:c:d')).toThrow(
        'Invalid encrypted payload format',
      );
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('secret data');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = Buffer.from('tampered').toString('base64');
      expect(() => service.decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = service.encrypt('secret data');
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[1] = randomBytes(16).toString('base64');
      expect(() => service.decrypt(parts.join(':'))).toThrow();
    });

    it('should throw when decrypting with wrong key', async () => {
      const service1 = await buildService(VALID_KEY);
      const differentKey = randomBytes(32).toString('hex');
      const service2 = await buildService(differentKey);

      const encrypted = service1.encrypt('secret');
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });

  describe('reEncrypt', () => {
    let service: EncryptionService;
    const NEW_KEY = randomBytes(32).toString('hex');

    beforeAll(async () => {
      service = await buildService(VALID_KEY);
    });

    it('should re-encrypt data with a new key', async () => {
      const plaintext = 'sensitive data for rotation';
      const encrypted = service.encrypt(plaintext);

      const reEncrypted = service.reEncrypt(encrypted, NEW_KEY);

      // re-encrypted should be different from original
      expect(reEncrypted).not.toBe(encrypted);

      // Build a new service with the new key to verify
      const newService = await buildService(NEW_KEY);
      expect(newService.decrypt(reEncrypted)).toBe(plaintext);
    });

    it('should throw if new key is invalid length', () => {
      const encrypted = service.encrypt('test');
      const shortKey = randomBytes(16).toString('hex');
      expect(() => service.reEncrypt(encrypted, shortKey)).toThrow(
        'New key must be exactly 32 bytes',
      );
    });
  });
});

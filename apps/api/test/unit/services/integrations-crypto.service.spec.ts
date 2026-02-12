import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationsCryptoService } from '@/modules/integrations/integrations-crypto.service';

describe('IntegrationsCryptoService', () => {
  let service: IntegrationsCryptoService;

  const testEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsCryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(testEncryptionKey),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationsCryptoService>(IntegrationsCryptoService);
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt plaintext correctly', () => {
      const plaintext = 'my-secret-api-key';

      const { ciphertext, iv } = service.encrypt(plaintext);

      expect(ciphertext).toBeDefined();
      expect(iv).toBeDefined();
      expect(ciphertext).not.toBe(plaintext);

      const decrypted = service.decrypt(ciphertext, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt JSON objects', () => {
      const config = { apiKey: 'test-key', secret: 'test-secret' };
      const plaintext = JSON.stringify(config);

      const { ciphertext, iv } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, iv);

      expect(JSON.parse(decrypted)).toEqual(config);
    });

    it('should generate different IVs for same plaintext', () => {
      const plaintext = 'same-plaintext';

      const result1 = service.encrypt(plaintext);
      const result2 = service.encrypt(plaintext);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.ciphertext).not.toBe(result2.ciphertext);

      expect(service.decrypt(result1.ciphertext, result1.iv)).toBe(plaintext);
      expect(service.decrypt(result2.ciphertext, result2.iv)).toBe(plaintext);
    });

    it('should encrypt empty strings', () => {
      const plaintext = '';

      const { ciphertext, iv } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long strings', () => {
      const plaintext = 'a'.repeat(10000);

      const { ciphertext, iv } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, iv);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt unicode characters', () => {
      const plaintext = '🔐 密钥 clé κλειδί';

      const { ciphertext, iv } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext, iv);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    it('should throw error if encryption key is not configured', () => {
      const module = Test.createTestingModule({
        providers: [
          IntegrationsCryptoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      expect(module.compile()).rejects.toThrow('INTEGRATION_ENCRYPTION_KEY not configured');
    });

    it('should throw error if encryption key is wrong length', () => {
      const module = Test.createTestingModule({
        providers: [
          IntegrationsCryptoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('short-key'),
            },
          },
        ],
      });

      expect(module.compile()).rejects.toThrow('must be 32 bytes');
    });

    it('should throw error when decrypting with wrong IV', () => {
      const plaintext = 'test';
      const { ciphertext } = service.encrypt(plaintext);
      const wrongIv = '0'.repeat(32);

      expect(() => service.decrypt(ciphertext, wrongIv)).toThrow();
    });

    it('should throw error when decrypting tampered ciphertext', () => {
      const plaintext = 'test';
      const { ciphertext, iv } = service.encrypt(plaintext);
      const tamperedCiphertext = '0' + ciphertext.slice(1);

      expect(() => service.decrypt(tamperedCiphertext, iv)).toThrow();
    });
  });

  describe('security', () => {
    it('should use 32-byte key', () => {
      const key = (service as any).key;
      expect(key.length).toBe(32);
    });

    it('should generate 16-byte IV', () => {
      const { iv } = service.encrypt('test');
      const ivBuffer = Buffer.from(iv, 'hex');
      expect(ivBuffer.length).toBe(16);
    });

    it('should include authentication tag', () => {
      const { ciphertext } = service.encrypt('test');
      // Auth tag is 16 bytes (32 hex chars) appended to ciphertext
      expect(ciphertext.length).toBeGreaterThan(32);
    });
  });
});

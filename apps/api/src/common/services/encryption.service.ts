import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypted payload format: iv:authTag:ciphertext (all base64 encoded)
 *
 * This service provides AES-256-GCM encryption for sensitive data at rest.
 * It validates the ENCRYPTION_KEY env var at startup and refuses to start
 * if the key is missing or invalid.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const keyHex = this.config.get<string>('ENCRYPTION_KEY');

    if (!keyHex) {
      throw new Error(
        'ENCRYPTION_KEY is not configured. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars), got ${key.length} bytes. ` +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    this.key = key;
    this.logger.log('EncryptionService initialized');
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns format: iv:authTag:ciphertext (base64 encoded components)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt a payload in the format iv:authTag:ciphertext (base64 encoded).
   * Throws if the payload is malformed or the key/tag is wrong.
   */
  decrypt(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted payload format. Expected iv:authTag:ciphertext',
      );
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`,
      );
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Re-encrypt data with a new key. Used for key rotation.
   * Decrypts with the current key, then encrypts with the provided new key.
   */
  reEncrypt(encryptedPayload: string, newKeyHex: string): string {
    const plaintext = this.decrypt(encryptedPayload);

    const newKey = Buffer.from(newKeyHex, 'hex');
    if (newKey.length !== 32) {
      throw new Error('New key must be exactly 32 bytes (64 hex chars)');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, newKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }
}

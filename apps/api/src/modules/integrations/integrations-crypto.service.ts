import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class IntegrationsCryptoService {
  private readonly logger = new Logger(IntegrationsCryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const keyString = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY');

    if (!keyString) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY not configured');
    }

    this.key = Buffer.from(keyString, 'hex');

    if (this.key.length !== 32) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
    }

    this.logger.log('Encryption service initialized');
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  decrypt(ciphertext: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');

    const authTag = Buffer.from(ciphertext.slice(-32), 'hex');
    const encrypted = ciphertext.slice(0, -32);

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encryptAES256GCM, decryptAES256GCM, parseEncryptionKey } from '@support-helper/shared';

@Injectable()
export class SsoCryptoService {
  private readonly logger = new Logger(SsoCryptoService.name);
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const keyString = this.config.get<string>('INTEGRATION_ENCRYPTION_KEY');

    if (!keyString) {
      throw new Error('INTEGRATION_ENCRYPTION_KEY not configured. SSO requires encryption for secrets.');
    }

    this.key = parseEncryptionKey(keyString);

    this.logger.log('SSO encryption service initialized');
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string } {
    return encryptAES256GCM(plaintext, this.key);
  }

  decrypt(ciphertext: string, ivHex: string): string {
    return decryptAES256GCM(ciphertext, ivHex, this.key);
  }
}

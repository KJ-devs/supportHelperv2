import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - String to encrypt
 * @param key - 32-byte encryption key
 * @returns Object with ciphertext (includes auth tag) and IV
 */
export function encryptAES256GCM(plaintext: string, key: Buffer): { ciphertext: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertext - Hex string with auth tag appended (last 32 chars)
 * @param ivHex - Initialization vector as hex string
 * @param key - 32-byte encryption key
 * @returns Decrypted plaintext
 */
export function decryptAES256GCM(ciphertext: string, ivHex: string, key: Buffer): string {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(ciphertext.slice(-32), 'hex');
  const encrypted = ciphertext.slice(0, -32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Parse and validate encryption key from hex string
 * @param keyHex - 64-character hex string (32 bytes)
 * @returns Buffer containing the key
 * @throws Error if key is not exactly 32 bytes
 */
export function parseEncryptionKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex chars)');
  }
  return key;
}

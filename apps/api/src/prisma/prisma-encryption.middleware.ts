import { Prisma } from '@prisma/client';
import { EncryptionService } from '../common/services/encryption.service';

/**
 * Map of Prisma model names to their encrypted field names.
 * Only fields encrypted via EncryptionService (AES-256-GCM, iv:authTag:ciphertext format).
 *
 * Integration model is excluded -- it uses IntegrationsCryptoService with
 * a separate key (INTEGRATION_ENCRYPTION_KEY) and different format (config + configIv).
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  GithubConnection: ['accessToken', 'refreshToken'],
  AiConfig: ['encryptedApiKey'],
};

/** Actions that write data and may contain plaintext to encrypt */
const WRITE_ACTIONS = ['create', 'update', 'upsert', 'createMany', 'updateMany'];

/** Actions that read data and may return encrypted values to decrypt */
const READ_ACTIONS = ['findFirst', 'findMany', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow'];

/**
 * Encrypt fields in a data object, skipping nullish values and already-encrypted values.
 */
function encryptFields(
  data: Record<string, unknown>,
  fields: string[],
  encryptionService: EncryptionService,
): void {
  for (const field of fields) {
    if (data[field] != null && typeof data[field] === 'string') {
      // Skip if already encrypted (double-encryption protection)
      if (!EncryptionService.isEncrypted(data[field])) {
        data[field] = encryptionService.encrypt(data[field]);
      }
    }
  }
}

/**
 * Decrypt fields in a single result object, skipping nullish values.
 * Silently skips values that fail decryption (may be legacy plaintext).
 */
function decryptFields(
  record: Record<string, unknown>,
  fields: string[],
  encryptionService: EncryptionService,
): void {
  for (const field of fields) {
    if (record[field] != null && typeof record[field] === 'string') {
      // Only attempt to decrypt values that look encrypted
      if (EncryptionService.isEncrypted(record[field])) {
        try {
          record[field] = encryptionService.decrypt(record[field]);
        } catch {
          // Leave value as-is if decryption fails (corrupted or wrong key)
        }
      }
    }
  }
}

/** Shape of write args passed by Prisma middleware for write operations */
interface WriteArgs {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
}

/**
 * Encrypt data in write args. Handles nested structures:
 * - create/update: args.data
 * - upsert: args.create and args.update
 * - createMany/updateMany: args.data (array or object)
 */
function encryptWriteArgs(
  action: string,
  args: WriteArgs,
  fields: string[],
  encryptionService: EncryptionService,
): void {
  if (!args) return;

  if (action === 'upsert') {
    if (args.create) encryptFields(args.create, fields, encryptionService);
    if (args.update) encryptFields(args.update, fields, encryptionService);
  } else if (action === 'createMany' || action === 'updateMany') {
    if (Array.isArray(args.data)) {
      for (const item of args.data) {
        encryptFields(item, fields, encryptionService);
      }
    } else if (args.data) {
      encryptFields(args.data as Record<string, unknown>, fields, encryptionService);
    }
  } else {
    // create, update
    if (args.data && !Array.isArray(args.data)) {
      encryptFields(args.data, fields, encryptionService);
    }
  }
}

/**
 * Decrypt results from read actions.
 */
function decryptResult(
  result: unknown,
  fields: string[],
  encryptionService: EncryptionService,
): void {
  if (!result) return;

  if (Array.isArray(result)) {
    for (const record of result) {
      if (record && typeof record === 'object') {
        decryptFields(record as Record<string, unknown>, fields, encryptionService);
      }
    }
  } else if (typeof result === 'object') {
    decryptFields(result as Record<string, unknown>, fields, encryptionService);
  }
}

/**
 * Creates a Prisma $use middleware that auto-encrypts sensitive fields on writes
 * and auto-decrypts them on reads.
 *
 * Safe to use alongside manual encrypt/decrypt: detects the iv:authTag:ciphertext
 * format to avoid double-encryption.
 */
export function createEncryptionMiddleware(
  encryptionService: EncryptionService,
): Prisma.Middleware {
  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const model = params.model as string | undefined;
    const action = params.action;

    if (!model || !ENCRYPTED_FIELDS[model]) {
      return next(params);
    }

    const fields = ENCRYPTED_FIELDS[model];

    // Encrypt on write
    if (WRITE_ACTIONS.includes(action)) {
      encryptWriteArgs(action, params.args, fields, encryptionService);
    }

    const result = await next(params);

    // Decrypt on read
    if (READ_ACTIONS.includes(action)) {
      decryptResult(result, fields, encryptionService);
    }

    return result;
  };
}

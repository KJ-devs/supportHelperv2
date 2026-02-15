/**
 * Encryption Key Rotation Script
 *
 * Re-encrypts all sensitive fields in the database from the old key to a new key.
 *
 * Usage:
 *   npx ts-node scripts/rotate-encryption-key.ts --old-key <OLD_HEX> --new-key <NEW_HEX>
 *
 * Or generate a new key automatically:
 *   npx ts-node scripts/rotate-encryption-key.ts --old-key <OLD_HEX> --generate
 *
 * Environment:
 *   DATABASE_URL must be set (or loaded from .env.local)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ── Encryption helpers (standalone, no service dependency) ──

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
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

function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function parseKey(hex: string): Buffer {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`Key must be 32 bytes (64 hex chars), got ${buf.length} bytes`);
  }
  return buf;
}

// ── CLI argument parsing ──

function parseArgs(): { oldKey: Buffer; newKey: Buffer; newKeyHex: string } {
  const args = process.argv.slice(2);
  let oldKeyHex: string | undefined;
  let newKeyHex: string | undefined;
  let generate = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--old-key' && args[i + 1]) {
      oldKeyHex = args[++i];
    } else if (args[i] === '--new-key' && args[i + 1]) {
      newKeyHex = args[++i];
    } else if (args[i] === '--generate') {
      generate = true;
    }
  }

  if (!oldKeyHex) {
    console.error('Error: --old-key <HEX> is required');
    console.error('');
    console.error('Usage:');
    console.error('  npx ts-node scripts/rotate-encryption-key.ts --old-key <OLD_HEX> --new-key <NEW_HEX>');
    console.error('  npx ts-node scripts/rotate-encryption-key.ts --old-key <OLD_HEX> --generate');
    process.exit(1);
  }

  if (!newKeyHex && !generate) {
    console.error('Error: either --new-key <HEX> or --generate is required');
    process.exit(1);
  }

  if (generate) {
    newKeyHex = randomBytes(32).toString('hex');
    console.log(`Generated new key: ${newKeyHex}`);
    console.log('IMPORTANT: Save this key securely. You will need it to set ENCRYPTION_KEY.');
    console.log('');
  }

  const oldKey = parseKey(oldKeyHex);
  const newKey = parseKey(newKeyHex!);

  if (oldKeyHex === newKeyHex) {
    console.error('Error: old and new keys are identical');
    process.exit(1);
  }

  return { oldKey, newKey, newKeyHex: newKeyHex! };
}

// ── Rotation logic ──

interface RotationStats {
  githubConnections: { total: number; rotated: number; failed: number };
  integrations: { total: number; rotated: number; failed: number };
}

async function rotateGithubTokens(
  prisma: PrismaClient,
  oldKey: Buffer,
  newKey: Buffer,
): Promise<RotationStats['githubConnections']> {
  const connections = await prisma.githubConnection.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });

  let rotated = 0;
  let failed = 0;

  for (const conn of connections) {
    try {
      const updates: Record<string, string | null> = {};

      if (conn.accessToken) {
        const plain = decryptWithKey(conn.accessToken, oldKey);
        updates.accessToken = encryptWithKey(plain, newKey);
      }
      if (conn.refreshToken) {
        const plain = decryptWithKey(conn.refreshToken, oldKey);
        updates.refreshToken = encryptWithKey(plain, newKey);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.githubConnection.update({
          where: { id: conn.id },
          data: updates,
        });
        rotated++;
      }
    } catch (err) {
      failed++;
      console.error(`  Failed to rotate GithubConnection ${conn.id}: ${(err as Error).message}`);
    }
  }

  return { total: connections.length, rotated, failed };
}

async function rotateIntegrationConfigs(
  prisma: PrismaClient,
  oldKey: Buffer,
  newKey: Buffer,
): Promise<RotationStats['integrations']> {
  const integrations = await prisma.integration.findMany({
    select: { id: true, config: true, accessToken: true, refreshToken: true },
  });

  let rotated = 0;
  let failed = 0;

  for (const integ of integrations) {
    try {
      const updates: Record<string, string | null | undefined> = {};

      // Config is stored in the new iv:authTag:ciphertext format
      if (integ.config) {
        const plain = decryptWithKey(integ.config, oldKey);
        updates.config = encryptWithKey(plain, newKey);
      }

      if (integ.accessToken) {
        const plain = decryptWithKey(integ.accessToken, oldKey);
        updates.accessToken = encryptWithKey(plain, newKey);
      }

      if (integ.refreshToken) {
        const plain = decryptWithKey(integ.refreshToken, oldKey);
        updates.refreshToken = encryptWithKey(plain, newKey);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.integration.update({
          where: { id: integ.id },
          data: updates,
        });
        rotated++;
      }
    } catch (err) {
      failed++;
      console.error(`  Failed to rotate Integration ${integ.id}: ${(err as Error).message}`);
    }
  }

  return { total: integrations.length, rotated, failed };
}

async function main() {
  const { oldKey, newKey, newKeyHex } = parseArgs();

  console.log('Starting encryption key rotation...');
  console.log('');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    console.log('Rotating GitHub connection tokens...');
    const githubStats = await rotateGithubTokens(prisma, oldKey, newKey);
    console.log(`  Total: ${githubStats.total}, Rotated: ${githubStats.rotated}, Failed: ${githubStats.failed}`);

    console.log('Rotating integration configs and tokens...');
    const integrationStats = await rotateIntegrationConfigs(prisma, oldKey, newKey);
    console.log(`  Total: ${integrationStats.total}, Rotated: ${integrationStats.rotated}, Failed: ${integrationStats.failed}`);

    console.log('');
    console.log('Key rotation complete.');

    const totalFailed = githubStats.failed + integrationStats.failed;
    if (totalFailed > 0) {
      console.error(`WARNING: ${totalFailed} record(s) failed to rotate. See errors above.`);
      console.error('These records may still be encrypted with the old key.');
      process.exitCode = 1;
    } else {
      console.log('All records rotated successfully.');
      console.log('');
      console.log('Next steps:');
      console.log(`  1. Update ENCRYPTION_KEY in your environment to: ${newKeyHex}`);
      console.log('  2. Restart the application');
      console.log('  3. Securely delete the old key');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error during key rotation:', err);
  process.exit(1);
});

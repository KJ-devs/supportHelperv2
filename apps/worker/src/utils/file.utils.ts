import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Create a temporary directory
 */
export async function createTempDir(prefix: string = 'worker-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Create a temporary file
 */
export async function createTempFile(
  prefix: string = 'file-',
  extension: string = '.tmp'
): Promise<string> {
  const tempDir = await createTempDir();
  return path.join(tempDir, `${prefix}${Date.now()}${extension}`);
}

/**
 * Delete a file or directory recursively
 */
export async function deleteRecursive(filePath: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: true, force: true });
    } else {
      await fs.unlink(filePath);
    }
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}

/**
 * Calculate file hash
 */
export async function getFileHash(filePath: string, algorithm: string = 'sha256'): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash(algorithm).update(content).digest('hex');
}

/**
 * List files in directory
 */
export async function listFiles(
  dirPath: string,
  filter?: (name: string) => boolean
): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let files = entries.filter(entry => entry.isFile()).map(entry => path.join(dirPath, entry.name));

  if (filter) {
    files = files.filter(f => filter(path.basename(f)));
  }

  return files;
}

/**
 * Copy file
 */
export async function copyFile(source: string, destination: string): Promise<void> {
  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
}

/**
 * Move file
 */
export async function moveFile(source: string, destination: string): Promise<void> {
  await ensureDir(path.dirname(destination));
  await fs.rename(source, destination);
}

/**
 * Read JSON file
 */
export async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
export async function writeJson(
  filePath: string,
  data: unknown,
  pretty: boolean = true
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

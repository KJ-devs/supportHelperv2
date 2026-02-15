const INDEXABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb',
  '.php', '.cs', '.md', '.prisma', '.sql', '.graphql', '.yaml', '.yml',
]);

const INDEXABLE_JSON = new Set([
  'package.json', 'tsconfig.json', 'turbo.json',
]);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.next', 'coverage', '__pycache__',
  '.turbo', '.cache', 'build', 'out', '.output', '.nuxt',
]);

const SKIP_FILES = new Set([
  'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock',
]);

/**
 * Determine if a file should be indexed for codebase embeddings.
 *
 * Checks directory exclusions, file exclusions, and extension allowlist.
 * Caller should additionally check file size (recommended max ~100KB).
 */
export function shouldIndexFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1];

  // Check directory exclusions
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) {
      return false;
    }
  }

  // Check file exclusions
  if (SKIP_FILES.has(fileName)) {
    return false;
  }

  // Check extension
  const ext = getExtension(fileName);

  // Special handling for JSON files
  if (ext === '.json') {
    return INDEXABLE_JSON.has(fileName);
  }

  return INDEXABLE_EXTENSIONS.has(ext);
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

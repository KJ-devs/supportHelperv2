import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';
import { PrismaService } from '../services/prisma.service';
import { GithubService } from '../services/github.service';
import { QUEUE_NAMES } from '../queues';
import { CodebaseIndexingJobData, CodebaseIndexingResult } from '../queues/queue.types';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

// ═══════════════════════════════════════════════════════════════════════
// INLINED FILE FILTER (from apps/api/src/ai/file-filter.ts)
// ═══════════════════════════════════════════════════════════════════════

const INDEXABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb',
  '.php', '.cs', '.md', '.prisma', '.sql', '.graphql', '.yaml', '.yml',
]);

const INDEXABLE_JSON = new Set(['package.json', 'tsconfig.json', 'turbo.json']);

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.next', 'coverage', '__pycache__',
  '.turbo', '.cache', 'build', 'out', '.output', '.nuxt',
]);

const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

function shouldIndexFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1] ?? '';

  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return false;
  }

  if (SKIP_FILES.has(fileName)) return false;

  const ext = getFileExtension(fileName);
  if (ext === '.json') return INDEXABLE_JSON.has(fileName);
  return INDEXABLE_EXTENSIONS.has(ext);
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════
// INLINED CODE CHUNKER (from apps/api/src/ai/code-chunker.ts)
// ═══════════════════════════════════════════════════════════════════════

interface CodeChunk {
  content: string;
  chunkIndex: number;
  language: string;
  startLine: number;
  endLine: number;
  metadata: {
    type: 'function' | 'class' | 'module' | 'section' | 'block';
    name?: string;
  };
}

const MAX_CHUNK_CHARS = 6000;
const DEFAULT_MAX_CHUNK_LINES = 80;
const DEFAULT_OVERLAP_LINES = 15;

function detectLanguage(filePath: string): string {
  const ext = getFileExtension(filePath);
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.java': 'java', '.go': 'go', '.rs': 'rust', '.rb': 'ruby',
    '.php': 'php', '.cs': 'csharp', '.md': 'markdown', '.prisma': 'prisma',
    '.sql': 'sql', '.graphql': 'graphql', '.yaml': 'yaml', '.yml': 'yaml', '.json': 'json',
  };
  return map[ext] || 'plaintext';
}

function chunkByLines(
  content: string, language: string, maxChunkLines: number, overlapLines: number,
): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + maxChunkLines, lines.length);
    chunks.push({
      content: lines.slice(start, end).join('\n'),
      chunkIndex: chunks.length,
      language,
      startLine: start + 1,
      endLine: end,
      metadata: { type: 'block' },
    });
    if (end >= lines.length) break;
    start = end - overlapLines;
  }

  return chunks;
}

function chunkTypeScript(
  content: string, language: string, maxChunkLines: number, overlapLines: number,
): CodeChunk[] {
  const lines = content.split('\n');
  const boundaryRegex =
    /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/;

  const boundaries: { line: number; name: string; type: CodeChunk['metadata']['type'] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!;
    if (trimmed.length > 0 && trimmed[0] !== ' ' && trimmed[0] !== '\t') {
      const match = trimmed.match(boundaryRegex);
      if (match && match[1]) {
        let type: CodeChunk['metadata']['type'] = 'block';
        if (/class\s/.test(trimmed)) type = 'class';
        else if (/function\s/.test(trimmed)) type = 'function';
        else if (/interface\s|type\s/.test(trimmed)) type = 'module';
        boundaries.push({ line: i, name: match[1], type });
      }
    }
  }

  if (boundaries.length === 0) {
    return chunkByLines(content, language, maxChunkLines, overlapLines);
  }

  const chunks: CodeChunk[] = [];
  for (let b = 0; b < boundaries.length; b++) {
    const boundary = boundaries[b]!;
    const nextBoundary = boundaries[b + 1];
    const start = b === 0 ? 0 : boundary.line;
    const end = nextBoundary ? nextBoundary.line - 1 : lines.length - 1;
    chunks.push({
      content: lines.slice(start, end + 1).join('\n'),
      chunkIndex: b,
      language,
      startLine: start + 1,
      endLine: end + 1,
      metadata: { type: boundary.type, name: boundary.name },
    });
  }

  return chunks;
}

function chunkCodeFile(content: string, filePath: string): CodeChunk[] {
  const ext = getFileExtension(filePath);
  const language = detectLanguage(filePath);

  if (!content.trim()) return [];

  let chunks: CodeChunk[];

  switch (ext) {
    case '.ts': case '.tsx': case '.js': case '.jsx':
      chunks = chunkTypeScript(content, language, DEFAULT_MAX_CHUNK_LINES, DEFAULT_OVERLAP_LINES);
      break;
    default:
      chunks = chunkByLines(content, language, DEFAULT_MAX_CHUNK_LINES, DEFAULT_OVERLAP_LINES);
      break;
  }

  const finalChunks: CodeChunk[] = [];
  for (const chunk of chunks) {
    const prefix = `// File: ${filePath} (lines ${chunk.startLine}-${chunk.endLine})\n`;
    const prefixedContent = prefix + chunk.content;

    if (prefixedContent.length > MAX_CHUNK_CHARS) {
      const chunkLines = chunk.content.split('\n');
      let start = 0;
      while (start < chunkLines.length) {
        const end = Math.min(start + DEFAULT_MAX_CHUNK_LINES, chunkLines.length);
        const subPrefix = `// File: ${filePath} (lines ${chunk.startLine + start}-${chunk.startLine + end - 1})\n`;
        finalChunks.push({
          content: subPrefix + chunkLines.slice(start, end).join('\n'),
          chunkIndex: 0,
          language: chunk.language,
          startLine: chunk.startLine + start,
          endLine: chunk.startLine + end - 1,
          metadata: { ...chunk.metadata },
        });
        if (end >= chunkLines.length) break;
        start = end - DEFAULT_OVERLAP_LINES;
      }
    } else {
      finalChunks.push({ ...chunk, content: prefixedContent });
    }
  }

  return finalChunks.map((c, i) => ({ ...c, chunkIndex: i }));
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const EMBEDDING_BATCH_SIZE = 100;

/**
 * CodebaseIndexingWorker
 *
 * BullMQ processor for codebase indexing:
 * - Clones repository via GitHub access token
 * - Walks files and filters indexable ones
 * - Chunks code files into semantic pieces
 * - Generates embeddings via OpenAI text-embedding-3-small
 * - Stores embeddings in PostgreSQL with pgvector
 *
 * Supports full and incremental indexing.
 */
@Processor(QUEUE_NAMES.CODEBASE_INDEXING, { concurrency: 2 })
export class CodebaseIndexingWorker extends WorkerHost {
  private readonly logger = new Logger(CodebaseIndexingWorker.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly configService: ConfigService,
    @InjectQueue('dead-letter')
    private readonly deadLetterQueue: Queue,
  ) {
    super();
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY') ||
                     this.configService.get<string>('openai.apiKey');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Get a GitHub access token for cloning the repo.
   * Looks up the GitHub connection for the tenant and uses its access token.
   */
  private async getAccessToken(tenantId: string, installationId: number): Promise<string> {
    // Try to find a GitHub connection for this tenant with the given installation
    const connection = await this.prisma.githubConnection.findFirst({
      where: {
        tenantId,
        installationId: BigInt(installationId),
      },
    });

    if (connection?.accessToken) {
      return connection.accessToken;
    }

    // Fallback: initialize GithubService with connection and use it
    if (connection) {
      await this.githubService.initialize({
        id: connection.id,
        installationId: connection.installationId,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
      });

      // If GithubService initialized successfully with app auth,
      // we can use the connection's access token directly
      if (connection.accessToken) {
        return connection.accessToken;
      }
    }

    throw new Error(
      `No GitHub access token found for tenant ${tenantId} with installation ${installationId}`,
    );
  }

  /**
   * Main processor method
   */
  async process(job: Job<CodebaseIndexingJobData>): Promise<CodebaseIndexingResult> {
    const { type, applicationId, tenantId, repoFullName, installationId, sinceCommitSha } = job.data;
    const startTime = Date.now();
    const tempDir = path.join(os.tmpdir(), `codebase-${applicationId}-${Date.now()}`);

    let filesProcessed = 0;
    let chunksCreated = 0;

    this.logger.log(`Starting ${type} for ${repoFullName}`, { applicationId, jobId: job.id });

    try {
      // 1. Update status to 'indexing'
      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: { status: 'indexing', error: null },
        create: { applicationId, status: 'indexing' },
      });

      await job.updateProgress(5);

      // 2. Get GitHub access token
      const token = await this.getAccessToken(tenantId, installationId);
      this.logger.log('Obtained GitHub access token');

      await job.updateProgress(10);

      // 3. Clone repo
      const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

      if (type === 'incremental-index' && sinceCommitSha) {
        // Need full history for diff
        execSync(`git clone "${cloneUrl}" "${tempDir}"`, { timeout: 120000, stdio: 'pipe' });
      } else {
        // Shallow clone for full index
        execSync(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`, { timeout: 120000, stdio: 'pipe' });
      }

      this.logger.log(`Cloned ${repoFullName} to ${tempDir}`);
      await job.updateProgress(15);

      // 4. Get HEAD SHA
      const headSha = execSync('git rev-parse HEAD', { cwd: tempDir, stdio: 'pipe' })
        .toString()
        .trim();

      this.logger.log(`HEAD SHA: ${headSha}`);

      // 5. Determine files to process
      let filesToProcess: string[];

      if (type === 'incremental-index' && sinceCommitSha) {
        // Get changed files since last indexed commit
        const diffOutput = execSync(
          `git diff --name-only ${sinceCommitSha}..HEAD`,
          { cwd: tempDir, stdio: 'pipe' },
        ).toString().trim();

        if (!diffOutput) {
          this.logger.log('No files changed since last index');

          await this.prisma.codebaseIndexStatus.update({
            where: { applicationId },
            data: { status: 'indexed', lastCommitSha: headSha, error: null },
          });

          return {
            success: true,
            type,
            filesProcessed: 0,
            chunksCreated: 0,
            duration: Date.now() - startTime,
          };
        }

        const changedFiles = diffOutput.split('\n').filter(Boolean);

        // Delete old chunks for changed files
        for (const changedFile of changedFiles) {
          await this.prisma.codebaseEmbedding.deleteMany({
            where: { applicationId, filePath: changedFile },
          });
        }

        // Also check for deleted files
        const deletedOutput = execSync(
          `git diff --diff-filter=D --name-only ${sinceCommitSha}..HEAD`,
          { cwd: tempDir, stdio: 'pipe' },
        ).toString().trim();

        const deletedFiles = new Set(deletedOutput ? deletedOutput.split('\n') : []);

        // Only process files that still exist and are indexable
        filesToProcess = changedFiles.filter(
          (f) => !deletedFiles.has(f) && shouldIndexFile(f),
        );
      } else {
        // Full index: walk all files
        filesToProcess = this.walkDirectory(tempDir)
          .map((absPath) => path.relative(tempDir, absPath).replace(/\\/g, '/'))
          .filter(shouldIndexFile);
      }

      this.logger.log(`Found ${filesToProcess.length} files to index`);
      await job.updateProgress(25);

      // 6. Chunk all files
      const allChunks: { filePath: string; chunk: CodeChunk }[] = [];

      for (const relPath of filesToProcess) {
        const absPath = path.join(tempDir, relPath);

        try {
          const stat = fs.statSync(absPath);
          if (stat.size > MAX_FILE_SIZE) continue;

          const content = fs.readFileSync(absPath, 'utf-8');
          const chunks = chunkCodeFile(content, relPath);

          for (const chunk of chunks) {
            allChunks.push({ filePath: relPath, chunk });
          }
        } catch {
          // Skip unreadable files (binary, permission issues)
          continue;
        }
      }

      filesProcessed = filesToProcess.length;
      this.logger.log(`Generated ${allChunks.length} chunks from ${filesProcessed} files`);
      await job.updateProgress(40);

      // 7. Generate embeddings in batches
      const openai = this.getOpenAI();
      const embeddings: { filePath: string; chunk: CodeChunk; embedding: number[] }[] = [];

      for (let i = 0; i < allChunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = allChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const texts = batch.map((b) => b.chunk.content);

        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
          });

          for (let j = 0; j < batch.length; j++) {
            const embeddingData = response.data[j]?.embedding;
            const batchItem = batch[j];
            if (embeddingData && batchItem) {
              embeddings.push({
                filePath: batchItem.filePath,
                chunk: batchItem.chunk,
                embedding: embeddingData,
              });
            }
          }
        } catch (error) {
          this.logger.error(
            `Embedding batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} failed: ${getErrorMessage(error)}`,
          );
          // Continue with next batch
        }

        // Update progress: 40-90% range for embedding generation
        const progress = 40 + Math.floor(((i + batch.length) / allChunks.length) * 50);
        await job.updateProgress(Math.min(progress, 90));
      }

      this.logger.log(`Generated ${embeddings.length} embeddings`);

      // 8. Delete old embeddings for full index
      if (type === 'full-index') {
        await this.prisma.codebaseEmbedding.deleteMany({
          where: { applicationId },
        });
      }

      // 9. Insert new embeddings using raw SQL for pgvector support
      for (let i = 0; i < embeddings.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = embeddings.slice(i, i + EMBEDDING_BATCH_SIZE);

        for (const entry of batch) {
          const embeddingStr = `[${entry.embedding.join(',')}]`;
          const metadata = JSON.stringify({
            type: entry.chunk.metadata.type,
            name: entry.chunk.metadata.name,
            startLine: entry.chunk.startLine,
            endLine: entry.chunk.endLine,
          });

          await this.prisma.$executeRawUnsafe(
            `INSERT INTO codebase_embeddings
              (id, tenant_id, application_id, file_path, chunk_index, content, embedding, language, last_commit_sha, metadata, created_at, updated_at)
            VALUES
              (uuid_generate_v4(), $1::uuid, $2::uuid, $3, $4, $5, $6::vector, $7, $8, $9::jsonb, NOW(), NOW())
            ON CONFLICT (application_id, file_path, chunk_index)
            DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              language = EXCLUDED.language,
              last_commit_sha = EXCLUDED.last_commit_sha,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()`,
            tenantId,
            applicationId,
            entry.filePath,
            entry.chunk.chunkIndex,
            entry.chunk.content,
            embeddingStr,
            entry.chunk.language,
            headSha,
            metadata,
          );
        }
      }

      chunksCreated = embeddings.length;
      await job.updateProgress(95);

      // 10. Update status
      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: {
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: filesProcessed,
          totalChunks: chunksCreated,
          error: null,
        },
        create: {
          applicationId,
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: filesProcessed,
          totalChunks: chunksCreated,
        },
      });

      await job.updateProgress(100);

      const duration = Date.now() - startTime;
      this.logger.log(`Completed ${type} for ${repoFullName}`, {
        filesProcessed,
        chunksCreated,
        duration,
      });

      return {
        success: true,
        type,
        filesProcessed,
        chunksCreated,
        duration,
      };
    } catch (error) {
      this.logger.error(`Failed ${type} for ${repoFullName}`, getErrorStack(error));

      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: { status: 'failed', error: getErrorMessage(error) },
        create: { applicationId, status: 'failed', error: getErrorMessage(error) },
      });

      return {
        success: false,
        type,
        filesProcessed: 0,
        chunksCreated: 0,
        duration: Date.now() - startTime,
        error: getErrorMessage(error),
      };
    } finally {
      // ALWAYS clean up temp directory
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean temp dir ${tempDir}`, cleanupError);
      }
    }
  }

  /**
   * Recursively walk a directory and return all file paths.
   */
  private walkDirectory(dir: string): string[] {
    const results: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        results.push(...this.walkDirectory(fullPath));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job<CodebaseIndexingJobData>) {
    this.logger.log(
      `Job ${job.id} started processing (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CodebaseIndexingJobData>, result: CodebaseIndexingResult) {
    this.logger.log(
      `Job ${job.id} completed - ${result.type} (${result.filesProcessed} files, ${result.chunksCreated} chunks, ${result.duration}ms)`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CodebaseIndexingJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without job context: ${error.message}`);
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 2;

    this.logger.error(
      `Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${getErrorMessage(error)}`,
      getErrorStack(error),
    );

    // If this was the last attempt, move to dead letter queue
    if (attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} exceeded max retries - moving to dead letter queue`);

      await this.deadLetterQueue.add(
        'failed-codebase-indexing',
        {
          originalJobId: job.id,
          queueName: QUEUE_NAMES.CODEBASE_INDEXING,
          jobData: job.data,
          failedReason: error.message,
          stacktrace: error.stack,
          attemptsMade,
          timestamp: new Date().toISOString(),
        },
        {
          removeOnComplete: {
            age: 90 * 24 * 60 * 60, // 90 days
          },
        },
      );
    }
  }
}

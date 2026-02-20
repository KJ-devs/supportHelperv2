import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { AIService } from '../../../ai/ai.service';
import { GithubAppService } from '../../github/services/github-app.service';
import { chunkCodeFile } from '../../../ai/code-chunker';
import { shouldIndexFile } from '../../../ai/file-filter';
import { IndexingResult } from '../types/codebase-index.types';
import { CodeChunk } from '../../../ai/code-chunker';

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const INSERT_BATCH_SIZE = 100;

interface CollectedChunk {
  filePath: string;
  chunkIndex: number;
  content: string;
  language: string;
  metadata: Record<string, any>;
}

@Injectable()
export class CodebaseIndexerService {
  private readonly logger = new Logger(CodebaseIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly githubAppService: GithubAppService,
    @InjectQueue('codebase-indexing') private readonly indexingQueue: Queue,
  ) {}

  /**
   * Queue a full indexing job for an application's linked GitHub repo.
   */
  async queueFullIndex(applicationId: string, tenantId: string): Promise<string> {
    const { repoFullName, installationId } = await this.getRepoConfig(applicationId, tenantId);

    await this.prisma.codebaseIndexStatus.upsert({
      where: { applicationId },
      update: { status: 'indexing', error: null },
      create: { applicationId, status: 'indexing' },
    });

    const job = await this.indexingQueue.add('full-index', {
      type: 'full-index',
      applicationId,
      tenantId,
      repoFullName,
      installationId,
      triggeredBy: 'manual',
    });

    this.logger.log(`Queued full index for ${repoFullName} (app: ${applicationId}), job: ${job.id}`);
    return job.id!;
  }

  /**
   * Queue an incremental index job (triggered by push webhook).
   */
  async queueIncrementalIndex(
    applicationId: string,
    tenantId: string,
    sinceCommitSha: string,
    triggeredBy: 'manual' | 'webhook' = 'manual',
  ): Promise<string> {
    const { repoFullName, installationId } = await this.getRepoConfig(applicationId, tenantId);

    await this.prisma.codebaseIndexStatus.upsert({
      where: { applicationId },
      update: { status: 'indexing', error: null },
      create: { applicationId, status: 'indexing' },
    });

    const job = await this.indexingQueue.add('incremental-index', {
      type: 'incremental-index',
      applicationId,
      tenantId,
      repoFullName,
      installationId,
      sinceCommitSha,
      triggeredBy,
    });

    this.logger.log(
      `Queued incremental index for ${repoFullName} since ${sinceCommitSha}, job: ${job.id}`,
    );
    return job.id!;
  }

  /**
   * Execute a full indexing operation.
   * Called by the BullMQ worker processor.
   */
  async executeFullIndex(
    applicationId: string,
    tenantId: string,
    repoFullName: string,
    installationId: number,
    onProgress?: (percent: number) => void,
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const tempDir = path.join(os.tmpdir(), `codebase-${applicationId}-${Date.now()}`);

    try {
      // 1. Get GitHub installation token
      const token = await this.githubAppService.getInstallationToken(installationId);

      // 2. Shallow clone the repo
      const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;
      execSync(`git clone --depth 1 "${cloneUrl}" "${tempDir}"`, {
        timeout: 120_000,
        stdio: 'pipe',
      });

      // 3. Get current HEAD SHA
      const headSha = execSync('git rev-parse HEAD', { cwd: tempDir, stdio: 'pipe' })
        .toString()
        .trim();

      // 4. Walk files and filter
      const allFiles = this.walkDirectory(tempDir);
      const eligibleFiles = allFiles.filter((f) => {
        const relativePath = path.relative(tempDir, f).replace(/\\/g, '/');
        if (!shouldIndexFile(relativePath)) return false;
        try {
          const stat = fs.statSync(f);
          return stat.size <= MAX_FILE_SIZE;
        } catch {
          return false;
        }
      });

      onProgress?.(20);

      // 5. Read and chunk files
      const chunks: CollectedChunk[] = [];
      for (const filePath of eligibleFiles) {
        const relativePath = path.relative(tempDir, filePath).replace(/\\/g, '/');
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const fileChunks = chunkCodeFile(content, relativePath);
          for (const chunk of fileChunks) {
            chunks.push({
              filePath: relativePath,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              language: chunk.language,
              metadata: chunk.metadata,
            });
          }
        } catch (err) {
          this.logger.warn(`Failed to read/chunk file ${relativePath}: ${err}`);
        }
      }

      onProgress?.(40);

      // 6. Generate embeddings in batches
      const allTexts = chunks.map((c) => c.content);
      const embeddings = await this.aiService.generateEmbeddings(allTexts);

      onProgress?.(70);

      // 7. Delete old embeddings for this application
      await this.prisma.codebaseEmbedding.deleteMany({
        where: { applicationId },
      });

      // 8. Insert new embeddings in batches
      for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
        const batch = chunks.slice(i, i + INSERT_BATCH_SIZE);
        const batchEmbeddings = embeddings.slice(i, i + INSERT_BATCH_SIZE);

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = batchEmbeddings[j];
          if (!embedding || embedding.length === 0) {
            this.logger.warn(`Skipping chunk ${chunk.filePath}:${chunk.chunkIndex} - empty embedding`);
            continue;
          }

          const embeddingStr = `[${embedding.join(',')}]`;
          const id = crypto.randomUUID();

          await this.prisma.$executeRaw`
            INSERT INTO codebase_embeddings (id, tenant_id, application_id, file_path, chunk_index, content, embedding, language, last_commit_sha, metadata, created_at, updated_at)
            VALUES (
              ${id}::uuid,
              ${tenantId}::uuid,
              ${applicationId}::uuid,
              ${chunk.filePath},
              ${chunk.chunkIndex},
              ${chunk.content},
              ${embeddingStr}::vector,
              ${chunk.language},
              ${headSha},
              ${JSON.stringify(chunk.metadata)}::jsonb,
              NOW(),
              NOW()
            )
          `;
        }
      }

      onProgress?.(90);

      // 9. Update CodebaseIndexStatus
      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: {
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: eligibleFiles.length,
          totalChunks: chunks.length,
          error: null,
        },
        create: {
          applicationId,
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: eligibleFiles.length,
          totalChunks: chunks.length,
        },
      });

      onProgress?.(100);

      const result: IndexingResult = {
        applicationId,
        filesProcessed: eligibleFiles.length,
        chunksCreated: chunks.length,
        duration: Date.now() - startTime,
        lastCommitSha: headSha,
      };

      this.logger.log(
        `Full index complete for ${repoFullName}: ${result.filesProcessed} files, ${result.chunksCreated} chunks in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Full index failed for ${repoFullName}: ${errMessage}`);

      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: { status: 'failed', error: errMessage },
        create: { applicationId, status: 'failed', error: errMessage },
      });
      throw error;
    } finally {
      // Always clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${cleanupErr}`);
      }
    }
  }

  /**
   * Execute incremental index - only changed files since a commit SHA.
   */
  async executeIncrementalIndex(
    applicationId: string,
    tenantId: string,
    repoFullName: string,
    installationId: number,
    sinceCommitSha: string,
    onProgress?: (percent: number) => void,
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const tempDir = path.join(os.tmpdir(), `codebase-${applicationId}-${Date.now()}`);

    try {
      // 1. Clone the repo (full clone needed for diff)
      const token = await this.githubAppService.getInstallationToken(installationId);
      const cloneUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;
      execSync(`git clone "${cloneUrl}" "${tempDir}"`, {
        timeout: 180_000,
        stdio: 'pipe',
      });

      // 2. Get current HEAD SHA
      const headSha = execSync('git rev-parse HEAD', { cwd: tempDir, stdio: 'pipe' })
        .toString()
        .trim();

      // 3. Get changed files since the given commit
      let changedFilesOutput: string;
      try {
        changedFilesOutput = execSync(
          `git diff --name-only ${sinceCommitSha}..HEAD`,
          { cwd: tempDir, stdio: 'pipe' },
        ).toString().trim();
      } catch {
        // If sinceCommitSha is not found (force push, etc.), fall back to full index
        this.logger.warn(
          `Commit ${sinceCommitSha} not found in ${repoFullName}, falling back to full index`,
        );
        return this.executeFullIndex(applicationId, tenantId, repoFullName, installationId, onProgress);
      }

      if (!changedFilesOutput) {
        // No changes
        await this.prisma.codebaseIndexStatus.upsert({
          where: { applicationId },
          update: { status: 'indexed', lastCommitSha: headSha, error: null },
          create: { applicationId, status: 'indexed', lastCommitSha: headSha },
        });
        onProgress?.(100);
        return {
          applicationId,
          filesProcessed: 0,
          chunksCreated: 0,
          duration: Date.now() - startTime,
          lastCommitSha: headSha,
        };
      }

      const changedFiles = changedFilesOutput
        .split('\n')
        .filter((f) => f.trim().length > 0);

      onProgress?.(20);

      // 4. Filter to indexable files that still exist
      const eligibleFiles = changedFiles.filter((relativePath) => {
        if (!shouldIndexFile(relativePath)) return false;
        const fullPath = path.join(tempDir, relativePath);
        try {
          const stat = fs.statSync(fullPath);
          return stat.size <= MAX_FILE_SIZE;
        } catch {
          return false; // file was deleted
        }
      });

      // Also collect deleted files to remove their old embeddings
      const deletedFiles = changedFiles.filter((relativePath) => {
        const fullPath = path.join(tempDir, relativePath);
        return !fs.existsSync(fullPath);
      });

      // 5. Delete old chunks for changed and deleted files
      const filesToClean = [...eligibleFiles, ...deletedFiles];
      if (filesToClean.length > 0) {
        await this.prisma.codebaseEmbedding.deleteMany({
          where: {
            applicationId,
            filePath: { in: filesToClean },
          },
        });
      }

      onProgress?.(40);

      // 6. Chunk and embed eligible files
      const chunks: CollectedChunk[] = [];
      for (const relativePath of eligibleFiles) {
        const fullPath = path.join(tempDir, relativePath);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const fileChunks = chunkCodeFile(content, relativePath);
          for (const chunk of fileChunks) {
            chunks.push({
              filePath: relativePath,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              language: chunk.language,
              metadata: chunk.metadata,
            });
          }
        } catch (err) {
          this.logger.warn(`Failed to read/chunk file ${relativePath}: ${err}`);
        }
      }

      const allTexts = chunks.map((c) => c.content);
      const embeddings = await this.aiService.generateEmbeddings(allTexts);

      onProgress?.(70);

      // 7. Insert new embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        if (!embedding || embedding.length === 0) {
          this.logger.warn(`Skipping chunk ${chunk.filePath}:${chunk.chunkIndex} - empty embedding`);
          continue;
        }

        const embeddingStr = `[${embedding.join(',')}]`;
        const id = crypto.randomUUID();

        await this.prisma.$executeRaw`
          INSERT INTO codebase_embeddings (id, tenant_id, application_id, file_path, chunk_index, content, embedding, language, last_commit_sha, metadata, created_at, updated_at)
          VALUES (
            ${id}::uuid,
            ${tenantId}::uuid,
            ${applicationId}::uuid,
            ${chunk.filePath},
            ${chunk.chunkIndex},
            ${chunk.content},
            ${embeddingStr}::vector,
            ${chunk.language},
            ${headSha},
            ${JSON.stringify(chunk.metadata)}::jsonb,
            NOW(),
            NOW()
          )
        `;
      }

      onProgress?.(90);

      // 8. Update status
      // Get total counts across all embeddings for this app
      const totalCount = await this.prisma.codebaseEmbedding.count({
        where: { applicationId },
      });
      const uniqueFiles = await this.prisma.codebaseEmbedding.groupBy({
        by: ['filePath'],
        where: { applicationId },
      });

      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: {
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: uniqueFiles.length,
          totalChunks: totalCount,
          error: null,
        },
        create: {
          applicationId,
          status: 'indexed',
          lastIndexedAt: new Date(),
          lastCommitSha: headSha,
          totalFiles: uniqueFiles.length,
          totalChunks: totalCount,
        },
      });

      onProgress?.(100);

      const result: IndexingResult = {
        applicationId,
        filesProcessed: eligibleFiles.length,
        chunksCreated: chunks.length,
        duration: Date.now() - startTime,
        lastCommitSha: headSha,
      };

      this.logger.log(
        `Incremental index complete for ${repoFullName}: ${result.filesProcessed} files, ${result.chunksCreated} chunks in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Incremental index failed for ${repoFullName}: ${errMessage}`);

      await this.prisma.codebaseIndexStatus.upsert({
        where: { applicationId },
        update: { status: 'failed', error: errMessage },
        create: { applicationId, status: 'failed', error: errMessage },
      });
      throw error;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${cleanupErr}`);
      }
    }
  }

  /**
   * Get indexing status for an application.
   */
  async getStatus(applicationId: string) {
    return this.prisma.codebaseIndexStatus.findUnique({
      where: { applicationId },
    });
  }

  /**
   * Look up ProjectGithubConfig and GithubInstallation for a given application.
   */
  private async getRepoConfig(
    applicationId: string,
    tenantId: string,
  ): Promise<{ repoFullName: string; installationId: number }> {
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
      include: { installation: true },
    });

    if (!config) {
      throw new BadRequestException(
        'No GitHub repository linked to this application. Connect a repo first.',
      );
    }

    // Verify the installation belongs to this tenant
    if (config.installation.tenantId !== tenantId) {
      throw new NotFoundException('GitHub configuration not found');
    }

    const repoFullName = `${config.owner}/${config.repo}`;
    const installationId = Number(config.installationId);

    return { repoFullName, installationId };
  }

  /**
   * Recursively walk a directory and return all file paths.
   */
  private walkDirectory(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip .git directory at any level
        if (entry.name === '.git') continue;
        files.push(...this.walkDirectory(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

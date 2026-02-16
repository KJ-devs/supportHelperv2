import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

const execFileAsync = promisify(execFile);

interface BackupJobData {
  includeMedia: boolean;
  label?: string;
  type: 'manual' | 'scheduled';
  triggeredAt: string;
}

interface RestoreJobData {
  filename: string;
  skipMedia: boolean;
  triggeredAt: string;
}

interface BackupResult {
  success: boolean;
  filename?: string;
  size?: number;
  duration?: number;
  error?: string;
}

/**
 * BackupWorker
 *
 * BullMQ consumer for backup/restore operations:
 * - create-backup: Database dump + optional MinIO backup
 * - restore-backup: Database restore + optional MinIO restore
 *
 * Uses pg_dump/pg_restore for PostgreSQL operations
 * Creates tar.gz archives in BACKUP_PATH
 */
@Processor('backup', {
  concurrency: 1, // Only one backup/restore at a time
})
export class BackupWorker extends WorkerHost {
  private readonly logger = new Logger(BackupWorker.name);
  private readonly backupPath: string;
  private readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.backupPath = this.configService.get<string>('BACKUP_PATH') || '/backups';
    this.databaseUrl = this.configService.get<string>('DATABASE_URL') || '';

    if (!this.databaseUrl) {
      this.logger.warn('DATABASE_URL not configured - backup operations will fail');
    }
  }

  /**
   * Main processor method
   */
  async process(job: Job): Promise<BackupResult> {
    const startTime = Date.now();

    switch (job.name) {
      case 'create-backup':
        return this.processBackup(job as Job<BackupJobData>, startTime);
      case 'restore-backup':
        return this.processRestore(job as Job<RestoreJobData>, startTime);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Process backup creation
   */
  private async processBackup(job: Job<BackupJobData>, startTime: number): Promise<BackupResult> {
    const { includeMedia, label, type } = job.data;

    this.logger.log(
      `Creating ${type} backup: includeMedia=${includeMedia}, label=${label || 'none'}`,
    );

    let tempDir: string | null = null;

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });

      // Create temporary directory for backup files
      tempDir = path.join(this.backupPath, `temp_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      await job.updateProgress(10);

      // Step 1: Database dump
      this.logger.log('Step 1: Creating database dump');
      const dbDumpPath = path.join(tempDir, 'database.sql');
      await this.dumpDatabase(dbDumpPath);
      await job.updateProgress(40);

      // Step 2: Optional media backup
      if (includeMedia) {
        this.logger.log('Step 2: Backing up media files');
        const mediaBackupPath = path.join(tempDir, 'media');
        await this.backupMedia(mediaBackupPath);
        await job.updateProgress(70);
      }

      // Step 3: Create tar.gz archive
      this.logger.log('Step 3: Creating tar.gz archive');
      const timestamp = this.formatTimestamp(new Date());
      const filename = `backup_${timestamp}_${type}.tar.gz`;
      const archivePath = path.join(this.backupPath, filename);

      await this.createTarball(tempDir, archivePath);

      await job.updateProgress(90);

      // Get archive size
      const stats = await fs.stat(archivePath);
      const size = stats.size;

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;

      const duration = Date.now() - startTime;

      this.logger.log(
        `Backup created successfully: ${filename} (${this.formatSize(size)}) in ${duration}ms`,
      );

      await job.updateProgress(100);

      return {
        success: true,
        filename,
        size,
        duration,
      };
    } catch (error) {
      this.logger.error(`Backup creation failed: ${getErrorMessage(error)}`, getErrorStack(error));

      return {
        success: false,
        error: getErrorMessage(error),
        duration: Date.now() - startTime,
      };
    } finally {
      // Cleanup temp directory if it still exists
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Process restore operation
   */
  private async processRestore(
    job: Job<RestoreJobData>,
    startTime: number,
  ): Promise<BackupResult> {
    const { filename, skipMedia } = job.data;

    this.logger.log(`Restoring from backup: ${filename}, skipMedia=${skipMedia}`);

    let tempDir: string | null = null;

    try {
      const backupFilePath = path.join(this.backupPath, filename);

      // Verify backup file exists
      await fs.access(backupFilePath);

      // Create temporary directory for extraction
      tempDir = path.join(this.backupPath, `restore_temp_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      await job.updateProgress(10);

      // Step 1: Extract tar.gz archive
      this.logger.log('Step 1: Extracting backup archive');
      await this.extractTarball(backupFilePath, tempDir);
      await job.updateProgress(30);

      // Step 2: Restore database
      this.logger.log('Step 2: Restoring database');
      const dbDumpPath = path.join(tempDir, 'database.sql');
      await this.restoreDatabase(dbDumpPath);
      await job.updateProgress(70);

      // Step 3: Optional media restore
      if (!skipMedia) {
        const mediaBackupPath = path.join(tempDir, 'media');
        try {
          await fs.access(mediaBackupPath);
          this.logger.log('Step 3: Restoring media files');
          await this.restoreMedia(mediaBackupPath);
        } catch {
          this.logger.warn('No media directory found in backup, skipping media restore');
        }
        await job.updateProgress(90);
      }

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;

      const duration = Date.now() - startTime;

      this.logger.log(`Restore completed successfully from ${filename} in ${duration}ms`);

      await job.updateProgress(100);

      return {
        success: true,
        filename,
        duration,
      };
    } catch (error) {
      this.logger.error(`Restore failed: ${getErrorMessage(error)}`, getErrorStack(error));

      return {
        success: false,
        error: getErrorMessage(error),
        duration: Date.now() - startTime,
      };
    } finally {
      // Cleanup temp directory if it still exists
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Dump database using pg_dump
   */
  private async dumpDatabase(outputPath: string): Promise<void> {
    this.logger.log(`Running pg_dump to: ${outputPath}`);

    try {
      const { stderr } = await execFileAsync('pg_dump', [
        '--no-owner',
        '--no-acl',
        '--clean',
        '--if-exists',
        '--file',
        outputPath,
        this.databaseUrl,
      ]);

      if (stderr) {
        this.logger.warn(`pg_dump stderr: ${stderr}`);
      }

      this.logger.log('Database dump completed successfully');
    } catch (error: any) {
      this.logger.error(`pg_dump failed: ${error.message}`);
      if (error.stderr) {
        this.logger.error(`pg_dump stderr: ${error.stderr}`);
      }
      throw new Error(`Database dump failed: ${error.message}`);
    }
  }

  /**
   * Restore database using psql
   */
  private async restoreDatabase(dumpPath: string): Promise<void> {
    this.logger.log(`Running psql restore from: ${dumpPath}`);

    try {
      // Execute via psql with input redirection
      const { stderr } = await execFileAsync('psql', [
        this.databaseUrl,
        '--quiet',
        '--file',
        dumpPath,
      ]);

      if (stderr) {
        this.logger.warn(`psql stderr: ${stderr}`);
      }

      this.logger.log('Database restore completed successfully');
    } catch (error: any) {
      this.logger.error(`psql restore failed: ${error.message}`);
      if (error.stderr) {
        this.logger.error(`psql stderr: ${error.stderr}`);
      }
      throw new Error(`Database restore failed: ${error.message}`);
    }
  }

  /**
   * Backup media files from MinIO/S3
   * For now, just create a placeholder directory
   * TODO: Implement actual S3 sync using S3Service or mc mirror
   */
  private async backupMedia(outputPath: string): Promise<void> {
    this.logger.log(`Creating media backup directory at: ${outputPath}`);

    try {
      await fs.mkdir(outputPath, { recursive: true });

      // TODO: Implement S3 sync
      // Option 1: Use S3Service to list and download all objects
      // Option 2: Use MinIO mc mirror command
      // For now, just log a warning
      this.logger.warn('Media backup not yet implemented - creating placeholder directory');

      // Create a README to indicate incomplete implementation
      const readmePath = path.join(outputPath, 'README.txt');
      await fs.writeFile(
        readmePath,
        'Media backup not yet fully implemented.\nThis directory is a placeholder for future S3/MinIO object backup.',
      );
    } catch (error) {
      this.logger.error(`Media backup failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Restore media files to MinIO/S3
   * For now, just log a warning
   * TODO: Implement actual S3 sync using S3Service or mc mirror
   */
  private async restoreMedia(inputPath: string): Promise<void> {
    this.logger.log(`Restoring media from: ${inputPath}`);

    try {
      // TODO: Implement S3 sync
      // Option 1: Use S3Service to upload all objects
      // Option 2: Use MinIO mc mirror command
      this.logger.warn('Media restore not yet implemented - skipping');
    } catch (error) {
      this.logger.error(`Media restore failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Create tar.gz archive using tar command
   */
  private async createTarball(sourceDir: string, outputPath: string): Promise<void> {
    this.logger.log(`Creating tarball: ${outputPath}`);

    try {
      // Use tar command: tar -czf output.tar.gz -C sourceDir .
      const { stderr } = await execFileAsync('tar', [
        '-czf',
        outputPath,
        '-C',
        sourceDir,
        '.',
      ]);

      if (stderr) {
        this.logger.warn(`tar create stderr: ${stderr}`);
      }

      this.logger.log('Tarball created successfully');
    } catch (error: any) {
      this.logger.error(`tar create failed: ${error.message}`);
      if (error.stderr) {
        this.logger.error(`tar stderr: ${error.stderr}`);
      }
      throw new Error(`Tarball creation failed: ${error.message}`);
    }
  }

  /**
   * Extract tar.gz archive using tar command
   */
  private async extractTarball(archivePath: string, targetDir: string): Promise<void> {
    this.logger.log(`Extracting tarball: ${archivePath} to ${targetDir}`);

    try {
      // Use tar command: tar -xzf archive.tar.gz -C targetDir
      const { stderr } = await execFileAsync('tar', [
        '-xzf',
        archivePath,
        '-C',
        targetDir,
      ]);

      if (stderr) {
        this.logger.warn(`tar extract stderr: ${stderr}`);
      }

      this.logger.log('Tarball extracted successfully');
    } catch (error: any) {
      this.logger.error(`tar extract failed: ${error.message}`);
      if (error.stderr) {
        this.logger.error(`tar stderr: ${error.stderr}`);
      }
      throw new Error(`Tarball extraction failed: ${error.message}`);
    }
  }

  /**
   * Format timestamp for filename
   * Returns: YYYYMMDD_HHmmss
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hour}${minute}${second}`;
  }

  /**
   * Format file size for logging
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) started processing`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: BackupResult) {
    if (result.success) {
      this.logger.log(
        `Job ${job.id} (${job.name}) completed successfully in ${result.duration}ms`,
      );
    } else {
      this.logger.error(`Job ${job.id} (${job.name}) completed with error: ${result.error}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without job context: ${error.message}`);
      return;
    }

    this.logger.error(
      `Job ${job.id} (${job.name}) failed: ${getErrorMessage(error)}`,
      getErrorStack(error),
    );
  }
}

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TriggerBackupDto } from './dto/trigger-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

export interface BackupMetadata {
  filename: string;
  size: number;
  date: Date;
  type: 'manual' | 'scheduled';
  label?: string;
}

export interface BackupStatus {
  jobId: string;
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed';
  progress?: number;
  result?: unknown;
  error?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupPath: string;

  constructor(
    @InjectQueue('backup') private readonly backupQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.backupPath = this.configService.get<string>('BACKUP_PATH') || '/backups';
  }

  /**
   * Trigger a manual backup
   * Enqueues a backup job on the BullMQ 'backup' queue
   */
  async triggerBackup(dto: TriggerBackupDto): Promise<{ jobId: string }> {
    this.logger.log(
      `Triggering backup: includeMedia=${dto.includeMedia}, label=${dto.label || 'none'}`,
    );

    try {
      const job = await this.backupQueue.add(
        'create-backup',
        {
          includeMedia: dto.includeMedia ?? true,
          label: dto.label,
          type: 'manual',
          triggeredAt: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      this.logger.log(`Backup job enqueued with ID: ${job.id}`);

      return { jobId: job.id as string };
    } catch (error) {
      this.logger.error('Failed to enqueue backup job', error);
      throw new InternalServerErrorException('Failed to trigger backup');
    }
  }

  /**
   * List all available backups from the backup directory
   */
  async listBackups(): Promise<BackupMetadata[]> {
    this.logger.log(`Listing backups from: ${this.backupPath}`);

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });

      // Read all files from backup directory
      const files = await fs.readdir(this.backupPath);

      // Filter backup files (*.tar.gz)
      const backupFiles = files.filter((file) => file.endsWith('.tar.gz'));

      // Get metadata for each backup
      const backups: BackupMetadata[] = await Promise.all(
        backupFiles.map(async (filename) => {
          const filePath = path.join(this.backupPath, filename);
          const stats = await fs.stat(filePath);

          // Parse filename: backup_YYYYMMDD_HHmmss_{manual|scheduled}.tar.gz
          const match = filename.match(/backup_(\d{8})_(\d{6})_(manual|scheduled)\.tar\.gz/);
          let date: Date;
          let type: 'manual' | 'scheduled' = 'manual';

          if (match) {
            const [, dateStr, timeStr, typeStr] = match;
            const year = parseInt(dateStr!.substring(0, 4), 10);
            const month = parseInt(dateStr!.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr!.substring(6, 8), 10);
            const hour = parseInt(timeStr!.substring(0, 2), 10);
            const minute = parseInt(timeStr!.substring(2, 4), 10);
            const second = parseInt(timeStr!.substring(4, 6), 10);

            date = new Date(year, month, day, hour, minute, second);
            type = typeStr as 'manual' | 'scheduled';
          } else {
            // Fallback to file modification time
            date = stats.mtime;
          }

          return {
            filename,
            size: stats.size,
            date,
            type,
          };
        }),
      );

      // Sort by date descending (newest first)
      backups.sort((a, b) => b.date.getTime() - a.date.getTime());

      this.logger.log(`Found ${backups.length} backup(s)`);

      return backups;
    } catch (error) {
      this.logger.error('Failed to list backups', error);
      throw new InternalServerErrorException('Failed to list backups');
    }
  }

  /**
   * Get status of a backup job
   */
  async getBackupStatus(jobId: string): Promise<BackupStatus> {
    this.logger.log(`Getting status for backup job: ${jobId}`);

    try {
      const job = await this.backupQueue.getJob(jobId);

      if (!job) {
        throw new NotFoundException(`Backup job ${jobId} not found`);
      }

      const state = await job.getState();
      const progress = job.progress;

      const status: BackupStatus = {
        jobId,
        status: state as 'active' | 'completed' | 'failed' | 'delayed' | 'waiting' | 'paused',
        progress: typeof progress === 'number' ? progress : undefined,
      };

      if (state === 'completed') {
        status.result = job.returnvalue;
      } else if (state === 'failed') {
        status.error = job.failedReason;
      }

      return status;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get backup status for job ${jobId}`, error);
      throw new InternalServerErrorException('Failed to get backup status');
    }
  }

  /**
   * Trigger a restore from a specific backup file
   */
  async restoreBackup(dto: RestoreBackupDto): Promise<{ jobId: string }> {
    this.logger.log(`Triggering restore from: ${dto.filename}`);

    // Validate backup file exists
    const backupFilePath = path.join(this.backupPath, dto.filename);

    try {
      await fs.access(backupFilePath);
    } catch {
      throw new BadRequestException(`Backup file ${dto.filename} not found`);
    }

    try {
      const job = await this.backupQueue.add(
        'restore-backup',
        {
          filename: dto.filename,
          skipMedia: dto.skipMedia ?? false,
          triggeredAt: new Date().toISOString(),
        },
        {
          attempts: 1, // Only one attempt for restore
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      this.logger.log(`Restore job enqueued with ID: ${job.id}`);

      return { jobId: job.id as string };
    } catch (error) {
      this.logger.error('Failed to enqueue restore job', error);
      throw new InternalServerErrorException('Failed to trigger restore');
    }
  }
}

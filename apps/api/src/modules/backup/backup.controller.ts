import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards';
import { BackupService } from './backup.service';
import { TriggerBackupDto } from './dto/trigger-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

/**
 * Backup Controller
 *
 * Admin-only endpoints for database backup and restore operations.
 * Note: Basic backup is available on all plans for disaster recovery.
 */
@ApiTags('system')
@Controller('system/backup')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @ApiOperation({
    summary: 'Trigger a manual backup',
    description:
      'Creates a backup of the database and optionally media files. Returns a job ID for tracking.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Backup job has been queued',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: '123456' },
      },
    },
  })
  async triggerBackup(@Body() dto: TriggerBackupDto) {
    return this.backupService.triggerBackup(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all available backups',
    description: 'Returns metadata for all backup files in the backup directory',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available backups',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filename: { type: 'string', example: 'backup_20260216_143000_manual.tar.gz' },
          size: { type: 'number', example: 1048576 },
          date: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['manual', 'scheduled'] },
          label: { type: 'string', example: 'Pre-migration backup' },
        },
      },
    },
  })
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get('status/:jobId')
  @ApiOperation({
    summary: 'Get backup job status',
    description: 'Returns the current status of a backup or restore job',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Backup job status',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'failed', 'waiting', 'delayed'],
        },
        progress: { type: 'number', minimum: 0, maximum: 100 },
        result: { type: 'object' },
        error: { type: 'string' },
      },
    },
  })
  async getBackupStatus(@Param('jobId') jobId: string) {
    return this.backupService.getBackupStatus(jobId);
  }

  @Post('restore')
  @ApiOperation({
    summary: 'Restore from a backup file',
    description:
      'Triggers a restore operation from a specific backup file. WARNING: This will overwrite current data.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Restore job has been queued',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: '123456' },
      },
    },
  })
  async restoreBackup(@Body() dto: RestoreBackupDto) {
    return this.backupService.restoreBackup(dto);
  }
}

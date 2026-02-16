import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

/**
 * Backup Module
 *
 * Provides database and media backup/restore functionality.
 * Uses BullMQ queue 'backup' for async processing in worker.
 *
 * Note: Basic backup is available on all plans for disaster recovery.
 * Advanced features (scheduled backups, retention policies) may be feature-gated.
 */
@Module({
  imports: [BullModule.registerQueue({ name: 'backup' })],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}

import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from '../../../src/modules/backup/backup.controller';
import { BackupService } from '../../../src/modules/backup/backup.service';
import { TriggerBackupDto } from '../../../src/modules/backup/dto/trigger-backup.dto';
import { RestoreBackupDto } from '../../../src/modules/backup/dto/restore-backup.dto';
import { NotFoundException } from '@nestjs/common';

describe('BackupController', () => {
  let controller: BackupController;
  let service: BackupService;

  const mockBackupService = {
    triggerBackup: jest.fn(),
    listBackups: jest.fn(),
    getBackupStatus: jest.fn(),
    restoreBackup: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: mockBackupService,
        },
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);
    service = module.get<BackupService>(BackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerBackup', () => {
    it('should trigger a backup with media', async () => {
      const dto: TriggerBackupDto = {
        includeMedia: true,
        label: 'test-backup',
      };
      const result = { jobId: 'job-123' };

      mockBackupService.triggerBackup.mockResolvedValue(result);

      expect(await controller.triggerBackup(dto)).toEqual(result);
      expect(service.triggerBackup).toHaveBeenCalledWith(dto);
    });

    it('should trigger a backup without media', async () => {
      const dto: TriggerBackupDto = {
        includeMedia: false,
      };
      const result = { jobId: 'job-456' };

      mockBackupService.triggerBackup.mockResolvedValue(result);

      expect(await controller.triggerBackup(dto)).toEqual(result);
      expect(service.triggerBackup).toHaveBeenCalledWith(dto);
    });
  });

  describe('listBackups', () => {
    it('should return list of backups', async () => {
      const backups = [
        {
          filename: 'backup_20260216_143000_manual.tar.gz',
          size: 1048576,
          date: new Date('2026-02-16T14:30:00'),
          type: 'manual' as const,
          label: 'test',
        },
        {
          filename: 'backup_20260215_120000_scheduled.tar.gz',
          size: 2097152,
          date: new Date('2026-02-15T12:00:00'),
          type: 'scheduled' as const,
        },
      ];

      mockBackupService.listBackups.mockResolvedValue(backups);

      expect(await controller.listBackups()).toEqual(backups);
      expect(service.listBackups).toHaveBeenCalled();
    });

    it('should return empty array when no backups exist', async () => {
      mockBackupService.listBackups.mockResolvedValue([]);

      expect(await controller.listBackups()).toEqual([]);
      expect(service.listBackups).toHaveBeenCalled();
    });
  });

  describe('getBackupStatus', () => {
    it('should return status for active job', async () => {
      const status = {
        jobId: 'job-123',
        status: 'active' as const,
        progress: 50,
      };

      mockBackupService.getBackupStatus.mockResolvedValue(status);

      expect(await controller.getBackupStatus('job-123')).toEqual(status);
      expect(service.getBackupStatus).toHaveBeenCalledWith('job-123');
    });

    it('should return completed job status with result', async () => {
      const status = {
        jobId: 'job-456',
        status: 'completed' as const,
        progress: 100,
        result: { filename: 'backup.tar.gz' },
      };

      mockBackupService.getBackupStatus.mockResolvedValue(status);

      expect(await controller.getBackupStatus('job-456')).toEqual(status);
      expect(service.getBackupStatus).toHaveBeenCalledWith('job-456');
    });

    it('should return failed job status with error', async () => {
      const status = {
        jobId: 'job-789',
        status: 'failed' as const,
        error: 'Disk full',
      };

      mockBackupService.getBackupStatus.mockResolvedValue(status);

      expect(await controller.getBackupStatus('job-789')).toEqual(status);
      expect(service.getBackupStatus).toHaveBeenCalledWith('job-789');
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockBackupService.getBackupStatus.mockRejectedValue(
        new NotFoundException('Backup job not-found not found'),
      );

      await expect(controller.getBackupStatus('not-found')).rejects.toThrow(NotFoundException);
      expect(service.getBackupStatus).toHaveBeenCalledWith('not-found');
    });
  });

  describe('restoreBackup', () => {
    it('should trigger restore with media', async () => {
      const dto: RestoreBackupDto = {
        filename: 'backup_20260216_143000_manual.tar.gz',
        skipMedia: false,
      };
      const result = { jobId: 'restore-123' };

      mockBackupService.restoreBackup.mockResolvedValue(result);

      expect(await controller.restoreBackup(dto)).toEqual(result);
      expect(service.restoreBackup).toHaveBeenCalledWith(dto);
    });

    it('should trigger restore without media', async () => {
      const dto: RestoreBackupDto = {
        filename: 'backup_20260216_143000_manual.tar.gz',
        skipMedia: true,
      };
      const result = { jobId: 'restore-456' };

      mockBackupService.restoreBackup.mockResolvedValue(result);

      expect(await controller.restoreBackup(dto)).toEqual(result);
      expect(service.restoreBackup).toHaveBeenCalledWith(dto);
    });
  });
});

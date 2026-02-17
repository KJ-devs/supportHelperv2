import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BackupService } from '../../../src/modules/backup/backup.service';
import { InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
  },
}));

describe('BackupService', () => {
  let service: BackupService;
  let queue: Queue;
  let configService: ConfigService;

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: getQueueToken('backup'),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
    queue = module.get<Queue>(getQueueToken('backup'));
    configService = module.get<ConfigService>(ConfigService);

    mockConfigService.get.mockReturnValue('/backups');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerBackup', () => {
    it('should enqueue backup job with all options', async () => {
      const dto = { includeMedia: true, label: 'test-backup' };
      const mockJob = { id: 'job-123' };

      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.triggerBackup(dto);

      expect(result).toEqual({ jobId: 'job-123' });
      expect(queue.add).toHaveBeenCalledWith(
        'create-backup',
        expect.objectContaining({
          includeMedia: true,
          label: 'test-backup',
          type: 'manual',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }),
      );
    });

    it('should use default includeMedia=true when not provided', async () => {
      const dto = {};
      const mockJob = { id: 'job-456' };

      mockQueue.add.mockResolvedValue(mockJob);

      await service.triggerBackup(dto);

      expect(queue.add).toHaveBeenCalledWith(
        'create-backup',
        expect.objectContaining({
          includeMedia: true,
        }),
        expect.anything(),
      );
    });

    it('should throw InternalServerErrorException when queue fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      await expect(service.triggerBackup({})).rejects.toThrow(InternalServerErrorException);
      await expect(service.triggerBackup({})).rejects.toThrow('Failed to trigger backup');
    });
  });

  describe('listBackups', () => {
    it('should return sorted list of backups', async () => {
      const mockFiles = [
        'backup_20260216_143000_manual.tar.gz',
        'backup_20260215_120000_scheduled.tar.gz',
        'other-file.txt', // Should be filtered out
      ];

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 1048576,
        mtime: new Date('2026-02-16T14:30:00'),
      });

      const backups = await service.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].filename).toBe('backup_20260216_143000_manual.tar.gz');
      expect(backups[0].type).toBe('manual');
      expect(backups[1].filename).toBe('backup_20260215_120000_scheduled.tar.gz');
      expect(backups[1].type).toBe('scheduled');
      expect(fs.mkdir).toHaveBeenCalledWith('/backups', { recursive: true });
    });

    it('should return empty array when no backup files exist', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const backups = await service.listBackups();

      expect(backups).toEqual([]);
    });

    it('should use fallback date when filename does not match pattern', async () => {
      const mockFiles = ['invalid-backup.tar.gz'];

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
      (fs.stat as jest.Mock).mockResolvedValue({
        size: 2048,
        mtime: new Date('2026-02-10T10:00:00'),
      });

      const backups = await service.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].date).toEqual(new Date('2026-02-10T10:00:00'));
      expect(backups[0].type).toBe('manual');
    });

    it('should throw InternalServerErrorException on file system error', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(service.listBackups()).rejects.toThrow(InternalServerErrorException);
      await expect(service.listBackups()).rejects.toThrow('Failed to list backups');
    });
  });

  describe('getBackupStatus', () => {
    it('should return active job status with progress', async () => {
      const mockJob = {
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const status = await service.getBackupStatus('job-123');

      expect(status).toEqual({
        jobId: 'job-123',
        status: 'active',
        progress: 50,
      });
      expect(queue.getJob).toHaveBeenCalledWith('job-123');
    });

    it('should return completed status with result', async () => {
      const mockJob = {
        id: 'job-456',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: { filename: 'backup.tar.gz', size: 1048576 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const status = await service.getBackupStatus('job-456');

      expect(status).toEqual({
        jobId: 'job-456',
        status: 'completed',
        progress: 100,
        result: { filename: 'backup.tar.gz', size: 1048576 },
      });
    });

    it('should return failed status with error message', async () => {
      const mockJob = {
        id: 'job-789',
        getState: jest.fn().mockResolvedValue('failed'),
        progress: 0,
        failedReason: 'Disk full',
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const status = await service.getBackupStatus('job-789');

      expect(status).toEqual({
        jobId: 'job-789',
        status: 'failed',
        progress: 0,
        error: 'Disk full',
      });
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.getBackupStatus('not-found')).rejects.toThrow(NotFoundException);
      await expect(service.getBackupStatus('not-found')).rejects.toThrow('Backup job not-found not found');
    });

    it('should throw InternalServerErrorException on queue error', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Queue connection failed'));

      await expect(service.getBackupStatus('job-123')).rejects.toThrow(InternalServerErrorException);
      await expect(service.getBackupStatus('job-123')).rejects.toThrow('Failed to get backup status');
    });
  });

  describe('restoreBackup', () => {
    it('should enqueue restore job when backup file exists', async () => {
      const dto = { filename: 'backup_20260216_143000_manual.tar.gz', skipMedia: false };
      const mockJob = { id: 'restore-123' };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.restoreBackup(dto);

      expect(result).toEqual({ jobId: 'restore-123' });
      // Check path with normalized separators
      const call = (fs.access as jest.Mock).mock.calls[0][0];
      expect(call).toMatch(/[\/\\]backups[\/\\]backup_20260216_143000_manual\.tar\.gz$/);
      expect(queue.add).toHaveBeenCalledWith(
        'restore-backup',
        expect.objectContaining({
          filename: dto.filename,
          skipMedia: false,
        }),
        expect.objectContaining({
          attempts: 1,
        }),
      );
    });

    it('should use default skipMedia=false when not provided', async () => {
      const dto = { filename: 'backup.tar.gz' };
      const mockJob = { id: 'restore-456' };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue(mockJob);

      await service.restoreBackup(dto);

      expect(queue.add).toHaveBeenCalledWith(
        'restore-backup',
        expect.objectContaining({
          skipMedia: false,
        }),
        expect.anything(),
      );
    });

    it('should throw BadRequestException when backup file does not exist', async () => {
      const dto = { filename: 'non-existent.tar.gz' };

      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      await expect(service.restoreBackup(dto)).rejects.toThrow(BadRequestException);
      await expect(service.restoreBackup(dto)).rejects.toThrow('Backup file non-existent.tar.gz not found');
    });

    it('should throw InternalServerErrorException when queue fails', async () => {
      const dto = { filename: 'backup.tar.gz' };

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      await expect(service.restoreBackup(dto)).rejects.toThrow(InternalServerErrorException);
      await expect(service.restoreBackup(dto)).rejects.toThrow('Failed to trigger restore');
    });
  });
});

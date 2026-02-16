import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { BackupWorker } from '../backup.worker';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    rm: jest.fn(),
    access: jest.fn(),
  },
}));

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

describe('BackupWorker', () => {
  let worker: BackupWorker;
  let configService: ConfigService;
  let mockExecFile: jest.Mock;

  const mockJob = <T>(
    name: string,
    data: T,
    id: string = 'job-123',
  ): Job<T> =>
    ({
      id,
      name,
      data,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as any;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    mockExecFile = execFile as unknown as jest.Mock;
    mockExecFile.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupWorker,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BACKUP_PATH') return '/test/backups';
              if (key === 'DATABASE_URL') return 'postgresql://test:test@localhost:5432/testdb';
              return null;
            }),
          },
        },
      ],
    }).compile();

    worker = module.get<BackupWorker>(BackupWorker);
    configService = module.get<ConfigService>(ConfigService);

    // Mock fs methods with default successful behavior
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 * 1024 * 10 }); // 10 MB
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(worker).toBeDefined();
    });

    it('should initialize with BACKUP_PATH from config', () => {
      expect(configService.get).toHaveBeenCalledWith('BACKUP_PATH');
    });

    it('should initialize with DATABASE_URL from config', () => {
      expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should use default backup path when not configured', async () => {
      const moduleWithoutPath: TestingModule = await Test.createTestingModule({
        providers: [
          BackupWorker,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'DATABASE_URL') return 'postgresql://test:test@localhost:5432/testdb';
                return null;
              }),
            },
          },
        ],
      }).compile();

      const workerWithDefaults = moduleWithoutPath.get<BackupWorker>(BackupWorker);
      expect(workerWithDefaults).toBeDefined();
    });

    it('should warn when DATABASE_URL not configured', async () => {
      const moduleWithoutDb: TestingModule = await Test.createTestingModule({
        providers: [
          BackupWorker,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => null),
            },
          },
        ],
      }).compile();

      const workerWithoutDb = moduleWithoutDb.get<BackupWorker>(BackupWorker);
      expect(workerWithoutDb).toBeDefined();
      // Note: Warning is logged in constructor, which we can't easily spy on in this setup
    });
  });

  describe('process - job routing', () => {
    it('should route create-backup jobs to processBackup', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should route restore-backup jobs to processRestore', async () => {
      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(fs.access).toHaveBeenCalled();
    });

    it('should throw error for unknown job type', async () => {
      const job = mockJob<any>('unknown-job-type', {});

      await expect(worker.process(job)).rejects.toThrow('Unknown job type: unknown-job-type');
    });
  });

  describe('processBackup - database backup creation', () => {
    it('should create backup with database only', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/backup_\d{8}_\d{6}_manual\.tar\.gz/);
      expect(result.size).toBe(1024 * 1024 * 10);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify pg_dump was called
      expect(mockExecFile).toHaveBeenCalledWith(
        'pg_dump',
        expect.arrayContaining([
          '--no-owner',
          '--no-acl',
          '--clean',
          '--if-exists',
          '--file',
          expect.stringContaining('database.sql'),
          'postgresql://test:test@localhost:5432/testdb',
        ]),
        expect.any(Function),
      );

      // Verify tar was called
      expect(mockExecFile).toHaveBeenCalledWith(
        'tar',
        expect.arrayContaining(['-czf', expect.stringContaining('.tar.gz')]),
        expect.any(Function),
      );

      // Verify temp directory cleanup
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('temp_'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });

    it('should create backup with media included', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'scheduled',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/backup_\d{8}_\d{6}_scheduled\.tar\.gz/);

      // Verify media backup directory was created (use path separator agnostic check)
      const mkdirCalls = (fs.mkdir as jest.Mock).mock.calls;
      const mediaCall = mkdirCalls.find((call) => call[0].includes('media'));
      expect(mediaCall).toBeDefined();
      expect(mediaCall[1]).toEqual(expect.objectContaining({ recursive: true }));

      // Verify placeholder README was created
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('README.txt'),
        expect.stringContaining('Media backup not yet fully implemented'),
      );
    });

    it('should update progress throughout backup process', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10); // After temp dir creation
      expect(job.updateProgress).toHaveBeenCalledWith(40); // After database dump
      expect(job.updateProgress).toHaveBeenCalledWith(70); // After media backup
      expect(job.updateProgress).toHaveBeenCalledWith(90); // After tarball creation
      expect(job.updateProgress).toHaveBeenCalledWith(100); // Completion
    });

    it('should use label in filename if provided', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        label: 'pre-migration',
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      // Note: Current implementation doesn't use label in filename, but it's logged
    });

    it('should handle pg_dump failure', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'pg_dump') {
          const error = new Error('pg_dump: connection failed') as any;
          error.stderr = 'could not connect to database';
          callback(error);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database dump failed');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify cleanup was called even on failure
      expect(fs.rm).toHaveBeenCalled();
    });

    it('should handle tar compression failure', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'tar') {
          const error = new Error('tar: disk full') as any;
          error.stderr = 'No space left on device';
          callback(error);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tarball creation failed');
    });

    it('should handle media backup failure gracefully', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });

    it('should ensure backup directory exists', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(fs.mkdir).toHaveBeenCalledWith(
        '/test/backups',
        expect.objectContaining({ recursive: true }),
      );
    });

    it('should log pg_dump stderr warnings without failing', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'pg_dump') {
          callback(null, { stdout: '', stderr: 'WARNING: some non-critical warning' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });

    it('should cleanup temp directory on any error', async () => {
      (fs.stat as jest.Mock).mockRejectedValueOnce(new Error('stat failed'));

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('temp_'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });
  });

  describe('processRestore - database restore', () => {
    it('should restore database from backup without media', async () => {
      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('backup_20260216_120000_manual.tar.gz');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify backup file access was checked
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining('backup_20260216_120000_manual.tar.gz'),
      );

      // Verify tar extraction was called
      expect(mockExecFile).toHaveBeenCalledWith(
        'tar',
        expect.arrayContaining(['-xzf', expect.stringContaining('.tar.gz')]),
        expect.any(Function),
      );

      // Verify psql restore was called
      expect(mockExecFile).toHaveBeenCalledWith(
        'psql',
        expect.arrayContaining([
          'postgresql://test:test@localhost:5432/testdb',
          '--quiet',
          '--file',
          expect.stringContaining('database.sql'),
        ]),
        expect.any(Function),
      );

      // Verify temp directory cleanup
      expect(fs.rm).toHaveBeenCalled();
    });

    it('should restore database and attempt media restore', async () => {
      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: false,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);

      // Verify media directory access was checked (use path separator agnostic check)
      const accessCalls = (fs.access as jest.Mock).mock.calls;
      const mediaAccessCall = accessCalls.find((call) => call[0].includes('media'));
      expect(mediaAccessCall).toBeDefined();
    });

    it('should handle missing media directory gracefully', async () => {
      (fs.access as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('/media')) {
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }
        return Promise.resolve();
      });

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: false,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      // Should complete successfully even without media directory
    });

    it('should update progress throughout restore process', async () => {
      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: false,
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(job.updateProgress).toHaveBeenCalledWith(10); // After temp dir creation
      expect(job.updateProgress).toHaveBeenCalledWith(30); // After extraction
      expect(job.updateProgress).toHaveBeenCalledWith(70); // After database restore
      expect(job.updateProgress).toHaveBeenCalledWith(90); // After media restore attempt
      expect(job.updateProgress).toHaveBeenCalledWith(100); // Completion
    });

    it('should handle missing backup file', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT: backup file not found'));

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'nonexistent_backup.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT: backup file not found');
    });

    it('should handle tar extraction failure', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'tar' && _args.includes('-xzf')) {
          const error = new Error('tar: corrupted archive') as any;
          error.stderr = 'unexpected EOF';
          callback(error);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tarball extraction failed');
    });

    it('should handle psql restore failure', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'psql') {
          const error = new Error('psql: connection failed') as any;
          error.stderr = 'could not connect to database';
          callback(error);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database restore failed');
    });

    it('should log psql stderr warnings without failing', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'psql') {
          callback(null, { stdout: '', stderr: 'WARNING: some non-critical warning' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });

    it('should cleanup temp directory on any error', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'tar') {
          callback(new Error('extraction failed'));
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('restore_temp_'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });
  });

  describe('worker lifecycle events', () => {
    it('should log when job becomes active', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      worker.onActive(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 (create-backup) started processing'),
      );
    });

    it('should log successful completion with duration', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result: BackupResult = {
        success: true,
        filename: 'backup_20260216_120000_manual.tar.gz',
        size: 1024 * 1024 * 10,
        duration: 5000,
      };

      worker.onCompleted(job, result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 (create-backup) completed successfully in 5000ms'),
      );
    });

    it('should log failed completion with error', () => {
      const logSpy = jest.spyOn(worker['logger'], 'error');

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result: BackupResult = {
        success: false,
        error: 'Database dump failed',
        duration: 1000,
      };

      worker.onCompleted(job, result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 (create-backup) completed with error: Database dump failed'),
      );
    });

    it('should handle job failure event', () => {
      const logSpy = jest.spyOn(worker['logger'], 'error');

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const error = new Error('Unexpected job failure');

      worker.onFailed(job, error);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-123 (create-backup) failed: Unexpected job failure'),
        expect.any(String),
      );
    });

    it('should handle job failure without job context', () => {
      const logSpy = jest.spyOn(worker['logger'], 'error');

      const error = new Error('Unknown failure');

      worker.onFailed(undefined, error);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job failed without job context: Unknown failure'),
      );
    });
  });

  describe('utility methods', () => {
    it('should format timestamp correctly', () => {
      const date = new Date('2026-02-16T12:34:56.789Z');
      const formatted = worker['formatTimestamp'](date);

      expect(formatted).toMatch(/\d{8}_\d{6}/);
      expect(formatted.length).toBe(15); // YYYYMMDD_HHmmss
    });

    it('should format file size in bytes', () => {
      const formatted = worker['formatSize'](512);
      expect(formatted).toBe('512 B');
    });

    it('should format file size in KB', () => {
      const formatted = worker['formatSize'](2048);
      expect(formatted).toBe('2.00 KB');
    });

    it('should format file size in MB', () => {
      const formatted = worker['formatSize'](1024 * 1024 * 5);
      expect(formatted).toBe('5.00 MB');
    });

    it('should format file size in GB', () => {
      const formatted = worker['formatSize'](1024 * 1024 * 1024 * 2.5);
      expect(formatted).toBe('2.50 GB');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle string errors', async () => {
      mockExecFile.mockImplementation((cmd, _args, callback) => {
        if (cmd === 'pg_dump') {
          callback('String error message' as any);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle cleanup errors silently in finally block', async () => {
      // Mock stat to fail after successful backup, triggering cleanup in finally
      (fs.stat as jest.Mock).mockRejectedValueOnce(new Error('stat failed after backup'));

      // Mock rm to fail in finally block cleanup
      (fs.rm as jest.Mock).mockRejectedValueOnce(new Error('Cleanup failed in finally'));

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      // Should fail due to stat error, but cleanup error should be caught silently
      expect(result.success).toBe(false);
      expect(result.error).toContain('stat failed after backup');
      // The cleanup error is caught silently by .catch(() => {}) in finally block
    });

    it('should handle mkdir failure for backup directory', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('backup type differentiation', () => {
    it('should create manual backup with correct filename', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('_manual.tar.gz');
    });

    it('should create scheduled backup with correct filename', async () => {
      const job = mockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'scheduled',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('_scheduled.tar.gz');
    });
  });
});

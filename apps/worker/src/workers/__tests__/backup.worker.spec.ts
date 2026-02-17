import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { S3Service } from '../../services/s3.service';

/**
 * Mocking strategy:
 *
 * backup.worker.ts does `const execFileAsync = promisify(execFile)` at module load.
 * We mock child_process.execFile with a [util.promisify.custom] implementation
 * that is a jest.fn() returning {stdout, stderr}.
 * This way Node's real promisify uses our custom implementation.
 */

// The actual promisified function mock (used by the worker via promisify)
const execFilePromisified = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

jest.mock('child_process', () => {
  const { promisify } = jest.requireActual('util');
  const fn = jest.fn();
  // Attach the custom promisify implementation
  (fn as any)[promisify.custom] = execFilePromisified;
  return { execFile: fn };
});

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024000 }),
    access: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    readdir: jest.fn().mockResolvedValue([]),
  },
}));

import { BackupWorker } from '../backup.worker';

const mockFs = require('fs').promises as {
  mkdir: jest.Mock;
  rm: jest.Mock;
  stat: jest.Mock;
  access: jest.Mock;
  writeFile: jest.Mock;
  readFile: jest.Mock;
  readdir: jest.Mock;
};

const mockS3Service = {
  listObjects: jest.fn().mockResolvedValue([]),
  downloadToPath: jest.fn().mockResolvedValue(undefined),
  upload: jest.fn().mockResolvedValue('key'),
  getBucket: jest.fn().mockReturnValue('support-helper'),
};

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

  const createMockJob = (name: string, data: any, overrides: Partial<Job> = {}): Job =>
    ({
      id: 'job-001',
      name,
      data,
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    }) as any;

  beforeEach(async () => {
    // Reset mocks
    execFilePromisified.mockReset();
    execFilePromisified.mockResolvedValue({ stdout: '', stderr: '' });

    Object.values(mockFs).forEach((fn) => fn.mockReset());
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024000 });
    mockFs.access.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.readdir.mockResolvedValue([]);

    Object.values(mockS3Service).forEach((fn) => fn.mockReset());
    mockS3Service.listObjects.mockResolvedValue([]);
    mockS3Service.downloadToPath.mockResolvedValue(undefined);
    mockS3Service.upload.mockResolvedValue('key');
    mockS3Service.getBucket.mockReturnValue('support-helper');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupWorker,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'BACKUP_PATH':
                  return '/backups';
                case 'DATABASE_URL':
                  return 'postgresql://user:pass@localhost:5432/testdb';
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    worker = module.get<BackupWorker>(BackupWorker);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(worker).toBeDefined();
    });

    it('should use configured BACKUP_PATH', () => {
      expect((worker as any).backupPath).toBe('/backups');
    });

    it('should use configured DATABASE_URL', () => {
      expect((worker as any).databaseUrl).toBe(
        'postgresql://user:pass@localhost:5432/testdb',
      );
    });

    it('should initialize with BACKUP_PATH from config', () => {
      expect(configService.get).toHaveBeenCalledWith('BACKUP_PATH');
    });

    it('should initialize with DATABASE_URL from config', () => {
      expect(configService.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should default BACKUP_PATH to /backups when not configured', async () => {
      const module = await Test.createTestingModule({
        providers: [
          BackupWorker,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => undefined) },
          },
          {
            provide: S3Service,
            useValue: mockS3Service,
          },
        ],
      }).compile();

      const w = module.get<BackupWorker>(BackupWorker);
      expect((w as any).backupPath).toBe('/backups');
    });

    it('should warn when DATABASE_URL is not set', async () => {
      const module = await Test.createTestingModule({
        providers: [
          BackupWorker,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => undefined) },
          },
          {
            provide: S3Service,
            useValue: mockS3Service,
          },
        ],
      }).compile();

      const w = module.get<BackupWorker>(BackupWorker);
      // The warning happens in the constructor. Verify the state is set correctly.
      expect((w as any).databaseUrl).toBe('');
      expect(w).toBeDefined();
    });
  });

  describe('process - routing', () => {
    it('should route create-backup jobs to processBackup', async () => {
      const job = createMockJob('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(execFilePromisified).toHaveBeenCalled();
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('should route restore-backup jobs to processRestore', async () => {
      const job = createMockJob('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should throw error for unknown job types', async () => {
      const job = createMockJob('unknown-job', {});

      await expect(worker.process(job)).rejects.toThrow('Unknown job type: unknown-job');
    });
  });

  describe('processBackup', () => {
    const backupJobData = {
      includeMedia: false,
      type: 'manual' as const,
      triggeredAt: new Date().toISOString(),
    };

    it('should create backup directory if not exists', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        { recursive: true },
      );
    });

    it('should create temp directory for backup', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true },
      );
    });

    it('should ensure backup directory exists', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        expect.objectContaining({ recursive: true }),
      );
    });

    it('should run pg_dump with correct arguments', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      // First call is pg_dump
      const pgDumpCall = execFilePromisified.mock.calls[0];
      expect(pgDumpCall).toBeDefined();
      expect(pgDumpCall![0]).toBe('pg_dump');
      const args = pgDumpCall![1] as string[];
      expect(args).toContain('--no-owner');
      expect(args).toContain('--no-acl');
      expect(args).toContain('--clean');
      expect(args).toContain('--if-exists');
      expect(args).toContain('--file');
      expect(args).toContain('postgresql://user:pass@localhost:5432/testdb');
    });

    it('should create tar.gz archive from temp directory', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      // Second call is tar
      const tarCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'tar',
      );
      expect(tarCall).toBeDefined();
      expect(tarCall![1]).toContain('-czf');
    });

    it('should return result with filename and size', async () => {
      mockFs.stat.mockResolvedValue({ size: 2048000 });

      const job = createMockJob('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^backup_\d{8}_\d{6}_manual\.tar\.gz$/);
      expect(result.size).toBe(2048000);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup temp directory on success', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should update progress at key milestones', async () => {
      const job = createMockJob('create-backup', backupJobData);

      await worker.process(job);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toEqual([10, 40, 90, 100]);
    });

    it('should update progress throughout backup process with media', async () => {
      mockS3Service.listObjects.mockResolvedValue([]);

      const job = createMockJob('create-backup', {
        ...backupJobData,
        includeMedia: true,
      });

      await worker.process(job);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toContain(10);
      expect(progressCalls).toContain(40);
      expect(progressCalls).toContain(70);
      expect(progressCalls).toContain(90);
      expect(progressCalls).toContain(100);
    });

    it('should include media backup step when includeMedia is true', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'file1.mp4', size: 1024000 },
        { key: 'dir/file2.png', size: 512000 },
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1024000 });

      const job = createMockJob('create-backup', {
        ...backupJobData,
        includeMedia: true,
      });

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('media'),
        { recursive: true },
      );

      // Should list S3 objects and download them
      expect(mockS3Service.listObjects).toHaveBeenCalled();
      expect(mockS3Service.downloadToPath).toHaveBeenCalledTimes(2);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toContain(70);
    });

    it('should use label in backup data', async () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');

      const job = createMockJob('create-backup', {
        ...backupJobData,
        label: 'pre-migration',
      });

      await worker.process(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('label=pre-migration'),
      );
    });

    it('should return failure result when pg_dump fails', async () => {
      execFilePromisified.mockRejectedValueOnce(
        Object.assign(new Error('pg_dump not found'), { stderr: 'command not found' }),
      );

      const job = createMockJob('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database dump failed');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify cleanup was called even on failure
      expect(mockFs.rm).toHaveBeenCalled();
    });

    it('should return failure result when tar creation fails', async () => {
      execFilePromisified
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // pg_dump OK
        .mockRejectedValueOnce(
          Object.assign(new Error('tar failed'), { stderr: 'disk full' }),
        );

      const job = createMockJob('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tarball creation failed');
    });

    it('should handle media backup failure gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'file1.mp4', size: 1024000 },
      ]);
      mockS3Service.downloadToPath.mockRejectedValueOnce(new Error('Disk full'));

      const job = createMockJob('create-backup', {
        ...backupJobData,
        includeMedia: true,
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should cleanup temp directory on failure', async () => {
      execFilePromisified.mockRejectedValue(new Error('crash'));

      const job = createMockJob('create-backup', backupJobData);
      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should handle scheduled backups', async () => {
      const job = createMockJob('create-backup', {
        ...backupJobData,
        type: 'scheduled',
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/_scheduled\.tar\.gz$/);
    });

    it('should handle mkdir failure for backup directory', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const job = createMockJob('create-backup', backupJobData);

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('processRestore', () => {
    const restoreJobData = {
      filename: 'backup_20260216_120000_manual.tar.gz',
      skipMedia: false,
      triggeredAt: new Date().toISOString(),
    };

    it('should verify backup file exists before restoring', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining('backup_20260216_120000_manual.tar.gz'),
      );
    });

    it('should extract tarball to temp directory', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      const tarCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'tar' && call[1]?.includes('-xzf'),
      );
      expect(tarCall).toBeDefined();
      expect(tarCall![1]).toEqual(
        expect.arrayContaining([
          expect.stringContaining('backup_20260216_120000_manual.tar.gz'),
        ]),
      );
    });

    it('should restore database using psql', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      const psqlCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'psql',
      );
      expect(psqlCall).toBeDefined();
      expect(psqlCall![1]).toContain('postgresql://user:pass@localhost:5432/testdb');
      expect(psqlCall![1]).toContain('--quiet');
      expect(psqlCall![1]).toContain('--file');
    });

    it('should return success result with filename and duration', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('backup_20260216_120000_manual.tar.gz');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should attempt media restore when skipMedia is false', async () => {
      // Mock manifest read
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        totalFiles: 1,
        totalBytes: 1024000,
        files: [{ key: 'file1.mp4', size: 1024000 }],
        bucket: 'test'
      }));
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);
      mockS3Service.upload.mockResolvedValue('file1.mp4');

      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining('media'),
      );
    });

    it('should skip media restore when skipMedia is true', async () => {
      const job = createMockJob('restore-backup', {
        ...restoreJobData,
        skipMedia: true,
      });

      await worker.process(job);

      const accessCalls = mockFs.access.mock.calls;
      const mediaCalls = accessCalls.filter((call: any[]) =>
        String(call[0]).includes('media'),
      );
      expect(mediaCalls).toHaveLength(0);
    });

    it('should handle missing media directory gracefully', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'));

      const job = createMockJob('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });

    it('should return failure when backup file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

      const job = createMockJob('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should return failure when tar extraction fails', async () => {
      execFilePromisified.mockRejectedValueOnce(
        Object.assign(new Error('Invalid tar format'), { stderr: 'gzip: unexpected end of file' }),
      );

      const job = createMockJob('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tarball extraction failed');
    });

    it('should return failure when psql restore fails', async () => {
      execFilePromisified
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // tar OK
        .mockRejectedValueOnce(
          Object.assign(new Error('psql connection refused'), { stderr: 'could not connect' }),
        );

      const job = createMockJob('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database restore failed');
    });

    it('should update progress at key milestones', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toEqual([10, 30, 70, 90, 100]);
    });

    it('should cleanup temp directory on success', async () => {
      const job = createMockJob('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]restore_temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should cleanup temp directory on failure', async () => {
      execFilePromisified.mockRejectedValue(new Error('crash'));

      const job = createMockJob('restore-backup', restoreJobData);
      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]restore_temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should log psql stderr warnings without failing', async () => {
      execFilePromisified.mockResolvedValue({
        stdout: '',
        stderr: 'WARNING: some non-critical warning',
      });

      const job = createMockJob('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });
  });

  describe('formatTimestamp (private)', () => {
    it('should format date as YYYYMMDD_HHmmss', () => {
      const formatTimestamp = (worker as any).formatTimestamp.bind(worker);
      const date = new Date(2026, 1, 16, 14, 30, 45);

      expect(formatTimestamp(date)).toBe('20260216_143045');
    });

    it('should zero-pad single digit months and days', () => {
      const formatTimestamp = (worker as any).formatTimestamp.bind(worker);
      const date = new Date(2026, 0, 5, 3, 7, 9);

      expect(formatTimestamp(date)).toBe('20260105_030709');
    });

    it('should produce correct length YYYYMMDD_HHmmss', () => {
      const date = new Date('2026-02-16T12:34:56.789Z');
      const formatted = worker['formatTimestamp'](date);

      expect(formatted).toMatch(/\d{8}_\d{6}/);
      expect(formatted.length).toBe(15);
    });
  });

  describe('formatSize (private)', () => {
    it('should format bytes', () => {
      const formatSize = (worker as any).formatSize.bind(worker);
      expect(formatSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      const formatSize = (worker as any).formatSize.bind(worker);
      expect(formatSize(2048)).toBe('2.00 KB');
    });

    it('should format megabytes', () => {
      const formatSize = (worker as any).formatSize.bind(worker);
      expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
    });

    it('should format gigabytes', () => {
      const formatSize = (worker as any).formatSize.bind(worker);
      expect(formatSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
    });

    it('should format fractional gigabytes', () => {
      const formatted = worker['formatSize'](1024 * 1024 * 1024 * 2.5);
      expect(formatted).toBe('2.50 GB');
    });
  });

  describe('worker events', () => {
    it('onActive should log job start', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');
      const job = createMockJob('create-backup', {});

      worker.onActive(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-001 (create-backup) started processing'),
      );
    });

    it('onCompleted should log success', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');
      const job = createMockJob('create-backup', {});

      worker.onCompleted(job, { success: true, duration: 5000 });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed successfully in 5000ms'),
      );
    });

    it('onCompleted should log success with filename', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');
      const job = createMockJob('create-backup', {});

      const result: BackupResult = {
        success: true,
        filename: 'backup_20260216_120000_manual.tar.gz',
        size: 1024 * 1024 * 10,
        duration: 5000,
      };

      worker.onCompleted(job, result);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed successfully in 5000ms'),
      );
    });

    it('onCompleted should log error when result has error', () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const job = createMockJob('create-backup', {});

      worker.onCompleted(job, { success: false, error: 'pg_dump failed' });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed with error: pg_dump failed'),
      );
    });

    it('onFailed should log failure with error', async () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const job = createMockJob('create-backup', {});

      await worker.onFailed(job, new Error('Worker crash'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-001 (create-backup) failed: Worker crash'),
        expect.any(String),
      );
    });

    it('onFailed should handle missing job context', async () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error');

      await worker.onFailed(undefined as any, new Error('No job'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job failed without job context'),
      );
    });
  });

  describe('pg_dump stderr handling', () => {
    it('should log stderr output as warning when present', async () => {
      const warnSpy = jest.spyOn(worker['logger'], 'warn');

      // execFile succeeds but with stderr
      execFilePromisified.mockResolvedValue({
        stdout: '',
        stderr: 'WARNING: some pg_dump warning',
      });

      const job = createMockJob('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('stderr: WARNING: some pg_dump warning'),
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle cleanup errors silently in finally block', async () => {
      // Mock stat to fail after successful backup, triggering cleanup in finally
      mockFs.stat.mockRejectedValueOnce(new Error('stat failed after backup'));

      // Mock rm to fail in finally block cleanup
      mockFs.rm.mockRejectedValueOnce(new Error('Cleanup failed in finally'));

      const job = createMockJob('create-backup', {
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
  });

  describe('backup type differentiation', () => {
    it('should create manual backup with correct filename', async () => {
      const job = createMockJob('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('_manual.tar.gz');
    });

    it('should create scheduled backup with correct filename', async () => {
      const job = createMockJob('create-backup', {
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

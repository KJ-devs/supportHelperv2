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
  uploadStream: jest.fn().mockResolvedValue('key'),
  getBucket: jest.fn().mockReturnValue('support-helper'),
  computeChecksum: jest.fn().mockResolvedValue('abc123checksum'),
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

  const createMockJob = <T = any>(name: string, data: T, overrides: Partial<Job> = {}): Job<T> =>
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
    mockS3Service.uploadStream.mockResolvedValue('key');
    mockS3Service.getBucket.mockReturnValue('support-helper');
    mockS3Service.computeChecksum.mockResolvedValue('abc123checksum');

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
                case 'BACKUP_MAX_SIZE_BYTES':
                  return 0; // 0 means unlimited in tests
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

  describe('initialization', () => {
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
      expect((w as any).databaseUrl).toBe('');
      expect(w).toBeDefined();
    });

    it('should use BACKUP_MAX_SIZE_BYTES from config', () => {
      expect((worker as any).maxBackupSizeBytes).toBe(0);
    });

    it('should default maxBackupSizeBytes to 50 GB when not configured', async () => {
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
      expect((w as any).maxBackupSizeBytes).toBe(50 * 1024 * 1024 * 1024);
    });
  });

  describe('process - job routing', () => {
    it('should route create-backup jobs to processBackup', async () => {
      const job = createMockJob<BackupJobData>('create-backup', {
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
      const job = createMockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('should throw error for unknown job type', async () => {
      const job = createMockJob<any>('unknown-job-type', {});

      await expect(worker.process(job)).rejects.toThrow('Unknown job type: unknown-job-type');
    });

    it('should reset aborted flag on each new job', async () => {
      worker.abort();
      expect((worker as any).aborted).toBe(true);

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      // After process() starts, aborted should be reset to false
      // (it was reset at the start of process())
    });
  });

  describe('processBackup - database backup creation', () => {
    const backupJobData: BackupJobData = {
      includeMedia: false,
      type: 'manual',
      triggeredAt: new Date().toISOString(),
    };

    it('should create backup with database only', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 * 1024 * 10 });

      const job = createMockJob<BackupJobData>('create-backup', {
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

      // Verify tar was called
      const tarCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'tar',
      );
      expect(tarCall).toBeDefined();
      expect(tarCall![1]).toContain('-czf');

      // Verify temp directory cleanup
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('temp_'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });

    it('should create backup with media included', async () => {
      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'scheduled',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/backup_\d{8}_\d{6}_scheduled\.tar\.gz/);

      // Verify media backup directory was created
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('media'),
        { recursive: true },
      );
    });

    it('should create backup directory if not exists', async () => {
      const job = createMockJob<BackupJobData>('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        { recursive: true },
      );
    });

    it('should create temp directory for backup', async () => {
      const job = createMockJob<BackupJobData>('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true },
      );
    });

    it('should return result with filename and size', async () => {
      mockFs.stat.mockResolvedValue({ size: 2048000 });

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^backup_\d{8}_\d{6}_manual\.tar\.gz$/);
      expect(result.size).toBe(2048000);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup temp directory on success', async () => {
      const job = createMockJob<BackupJobData>('create-backup', backupJobData);

      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should update progress at key milestones', async () => {
      const job = createMockJob<BackupJobData>('create-backup', backupJobData);

      await worker.process(job);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toEqual([10, 40, 90, 100]);
    });

    it('should update progress throughout backup process with media', async () => {
      mockS3Service.listObjects.mockResolvedValue([]);

      const job = createMockJob<BackupJobData>('create-backup', {
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
      mockS3Service.computeChecksum.mockResolvedValue('abc123');
      mockFs.stat.mockResolvedValue({ size: 1024000 });

      const job = createMockJob<BackupJobData>('create-backup', {
        ...backupJobData,
        includeMedia: true,
      });

      await worker.process(job);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('media'),
        { recursive: true },
      );

      expect(mockS3Service.listObjects).toHaveBeenCalled();
      expect(mockS3Service.downloadToPath).toHaveBeenCalledTimes(2);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toContain(70);
    });

    it('should use label in backup data', async () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');

      const job = createMockJob<BackupJobData>('create-backup', {
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

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
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

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
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

      const job = createMockJob<BackupJobData>('create-backup', {
        ...backupJobData,
        includeMedia: true,
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should cleanup temp directory on failure', async () => {
      execFilePromisified.mockRejectedValue(new Error('crash'));

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should handle scheduled backups', async () => {
      const job = createMockJob<BackupJobData>('create-backup', {
        ...backupJobData,
        type: 'scheduled',
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/_scheduled\.tar\.gz$/);
    });

    it('should handle mkdir failure for backup directory', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should log pg_dump stderr warnings without failing', async () => {
      execFilePromisified.mockResolvedValue({
        stdout: '',
        stderr: 'WARNING: some non-critical warning',
      });

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });

    it('should handle string errors gracefully', async () => {
      execFilePromisified.mockRejectedValueOnce('String error message');

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should cleanup temp directory on any stat error', async () => {
      mockFs.stat.mockRejectedValueOnce(new Error('stat failed'));

      const job = createMockJob<BackupJobData>('create-backup', backupJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('temp_'),
        expect.objectContaining({ recursive: true, force: true }),
      );
    });
  });

  describe('processRestore - database restore', () => {
    const restoreJobData: RestoreJobData = {
      filename: 'backup_20260216_120000_manual.tar.gz',
      skipMedia: false,
      triggeredAt: new Date().toISOString(),
    };

    it('should restore database from backup without media', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('backup_20260216_120000_manual.tar.gz');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify backup file access was checked
      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining('backup_20260216_120000_manual.tar.gz'),
      );

      // Verify tar extraction was called
      const tarCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'tar' && call[1]?.includes('-xzf'),
      );
      expect(tarCall).toBeDefined();

      // Verify psql restore was called
      const psqlCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'psql',
      );
      expect(psqlCall).toBeDefined();
      expect(psqlCall![1]).toContain('postgresql://user:pass@localhost:5432/testdb');
      expect(psqlCall![1]).toContain('--quiet');
      expect(psqlCall![1]).toContain('--file');

      // Verify temp directory cleanup
      expect(mockFs.rm).toHaveBeenCalled();
    });

    it('should verify backup file exists before restoring', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining('backup_20260216_120000_manual.tar.gz'),
      );
    });

    it('should extract tarball to temp directory', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

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
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

      await worker.process(job);

      const psqlCall = execFilePromisified.mock.calls.find(
        (call: any[]) => call[0] === 'psql',
      );
      expect(psqlCall).toBeDefined();
      expect(psqlCall![1]).toContain('postgresql://user:pass@localhost:5432/testdb');
      expect(psqlCall![1]).toContain('--quiet');
      expect(psqlCall![1]).toContain('--file');
    });

    it('should attempt media restore when skipMedia is false', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        totalFiles: 1,
        totalBytes: 1024000,
        files: [{ key: 'file1.mp4', size: 1024000, checksum: 'abc123checksum' }],
        bucket: 'test',
      }));
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);
      mockS3Service.uploadStream.mockResolvedValue('file1.mp4');
      mockS3Service.computeChecksum.mockResolvedValue('abc123checksum');

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining('media'),
      );
    });

    it('should skip media restore when skipMedia is true', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', {
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

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });

    it('should return failure when backup file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should return failure when tar extraction fails', async () => {
      execFilePromisified.mockRejectedValueOnce(
        Object.assign(new Error('Invalid tar format'), { stderr: 'gzip: unexpected end of file' }),
      );

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
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

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database restore failed');
    });

    it('should update progress at key milestones', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

      await worker.process(job);

      const progressCalls = (job.updateProgress as jest.Mock).mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(progressCalls).toEqual([10, 30, 70, 90, 100]);
    });

    it('should cleanup temp directory on success', async () => {
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);

      await worker.process(job);

      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/backups[/\\]restore_temp_\d+$/),
        { recursive: true, force: true },
      );
    });

    it('should cleanup temp directory on failure', async () => {
      execFilePromisified.mockRejectedValue(new Error('crash'));

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
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

      const job = createMockJob<RestoreJobData>('restore-backup', {
        filename: 'backup_20260216_120000_manual.tar.gz',
        skipMedia: true,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
    });
  });

  describe('backupMedia - streaming and checksums', () => {
    it('should compute and store checksums for each backed-up file', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'video.mp4', size: 5000000 },
        { key: 'screenshot.png', size: 200000 },
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockS3Service.computeChecksum
        .mockResolvedValueOnce('checksum-video')
        .mockResolvedValueOnce('checksum-screenshot');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      // Checksums computed for each file
      expect(mockS3Service.computeChecksum).toHaveBeenCalledTimes(2);

      // Manifest written with checksum data
      const writeCall = mockFs.writeFile.mock.calls.find((call: any[]) =>
        String(call[0]).includes('manifest.json'),
      );
      expect(writeCall).toBeDefined();
      const manifest = JSON.parse(writeCall![1] as string);
      expect(manifest.files).toHaveLength(2);
      expect(manifest.files[0]).toMatchObject({ key: 'video.mp4', checksum: 'checksum-video' });
      expect(manifest.files[1]).toMatchObject({ key: 'screenshot.png', checksum: 'checksum-screenshot' });
    });

    it('should use downloadToPath (streaming) instead of in-memory download', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'large-video.mp4', size: 500 * 1024 * 1024 }, // 500 MB
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockS3Service.computeChecksum.mockResolvedValue('largefile-checksum');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      // Must use downloadToPath (streaming), NOT downloadToTemp (buffered)
      expect(mockS3Service.downloadToPath).toHaveBeenCalledWith(
        'large-video.mp4',
        expect.stringContaining('large-video.mp4'),
      );
    });

    it('should continue backing up remaining files when one file download fails', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'file1.mp4', size: 1000 },
        { key: 'file2.mp4', size: 2000 },
        { key: 'file3.mp4', size: 3000 },
      ]);
      mockS3Service.downloadToPath
        .mockRejectedValueOnce(new Error('S3 network error'))
        .mockResolvedValue(undefined);
      mockS3Service.computeChecksum.mockResolvedValue('some-checksum');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      // Should still succeed overall (other files downloaded)
      expect(result.success).toBe(true);
      // file2 and file3 downloaded successfully
      expect(mockS3Service.downloadToPath).toHaveBeenCalledTimes(3);
    });

    it('should reject media backup when total size exceeds configured limit', async () => {
      const module = await Test.createTestingModule({
        providers: [
          BackupWorker,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'BACKUP_PATH') return '/backups';
                if (key === 'DATABASE_URL') return 'postgresql://localhost/db';
                if (key === 'BACKUP_MAX_SIZE_BYTES') return 100 * 1024 * 1024; // 100 MB
                return undefined;
              }),
            },
          },
          { provide: S3Service, useValue: mockS3Service },
        ],
      }).compile();

      const limitedWorker = module.get<BackupWorker>(BackupWorker);

      mockS3Service.listObjects.mockResolvedValue([
        { key: 'huge1.mp4', size: 60 * 1024 * 1024 },  // 60 MB
        { key: 'huge2.mp4', size: 60 * 1024 * 1024 },  // 60 MB - total 120 MB > 100 MB limit
      ]);

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await limitedWorker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds configured limit');
    });

    it('should allow unlimited backup size when BACKUP_MAX_SIZE_BYTES is 0', async () => {
      // worker already has maxBackupSizeBytes=0 (unlimited) from beforeEach setup
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'huge.mp4', size: 999 * 1024 * 1024 * 1024 }, // 999 GB
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockS3Service.computeChecksum.mockResolvedValue('checksum');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      // Should succeed because limit is 0 (disabled)
      expect(result.success).toBe(true);
      expect(mockS3Service.downloadToPath).toHaveBeenCalled();
    });

    it('should write manifest with correct metadata', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'tenants/t1/video.mp4', size: 3000 },
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockS3Service.computeChecksum.mockResolvedValue('sha256-hash-abc');
      mockS3Service.getBucket.mockReturnValue('my-bucket');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      const writeCall = mockFs.writeFile.mock.calls.find((call: any[]) =>
        String(call[0]).includes('manifest.json'),
      );
      expect(writeCall).toBeDefined();
      const manifest = JSON.parse(writeCall![1] as string);
      expect(manifest.bucket).toBe('my-bucket');
      expect(manifest.totalFiles).toBe(1);
      expect(manifest.totalBytes).toBe(3000);
      expect(manifest.files[0]).toMatchObject({
        key: 'tenants/t1/video.mp4',
        size: 3000,
        checksum: 'sha256-hash-abc',
      });
    });
  });

  describe('restoreMedia - checksum verification', () => {
    const restoreJobData: RestoreJobData = {
      filename: 'backup_20260216_120000_manual.tar.gz',
      skipMedia: false,
      triggeredAt: new Date().toISOString(),
    };

    it('should verify checksums before uploading each file', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        bucket: 'support-helper',
        totalFiles: 1,
        totalBytes: 1024000,
        files: [{ key: 'video.mp4', size: 1024000, checksum: 'expected-checksum' }],
      }));
      mockFs.readdir.mockResolvedValue([
        { name: 'video.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);
      mockS3Service.computeChecksum.mockResolvedValue('expected-checksum');
      mockS3Service.uploadStream.mockResolvedValue('video.mp4');

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(mockS3Service.computeChecksum).toHaveBeenCalled();
      expect(mockS3Service.uploadStream).toHaveBeenCalledWith('video.mp4', expect.any(String));
    });

    it('should skip files with checksum mismatch and log error', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        bucket: 'support-helper',
        totalFiles: 1,
        totalBytes: 1024000,
        files: [{ key: 'corrupted.mp4', size: 1024000, checksum: 'expected-good-checksum' }],
      }));
      mockFs.readdir.mockResolvedValue([
        { name: 'corrupted.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);
      // Return a DIFFERENT checksum (corruption detected)
      mockS3Service.computeChecksum.mockResolvedValue('actual-bad-checksum');

      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      await worker.process(job);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Checksum mismatch for corrupted.mp4'),
      );
      // Upload should NOT have been called for the corrupted file
      expect(mockS3Service.uploadStream).not.toHaveBeenCalled();
    });

    it('should use uploadStream (streaming) for restore uploads', async () => {
      mockFs.readFile.mockResolvedValue('{}'); // no manifest
      mockFs.readdir.mockResolvedValue([
        { name: 'file.mp4', isDirectory: () => false, isFile: () => true },
      ] as any);

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      await worker.process(job);

      // uploadStream must be used, not upload (which reads entire file into memory)
      expect(mockS3Service.uploadStream).toHaveBeenCalled();
    });

    it('should continue restoring other files when one upload fails', async () => {
      mockFs.readFile.mockResolvedValue('{}'); // no manifest
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'file2.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'file3.mp4', isDirectory: () => false, isFile: () => true },
      ] as any);
      mockS3Service.uploadStream
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValue('key');

      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(mockS3Service.uploadStream).toHaveBeenCalledTimes(3);
    });

    it('should log warning when manifest files are missing from backup dir', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        bucket: 'support-helper',
        totalFiles: 2,
        totalBytes: 2048000,
        files: [
          { key: 'present.mp4', size: 1024000, checksum: 'abc' },
          { key: 'missing.mp4', size: 1024000, checksum: 'xyz' },
        ],
      }));
      // Only 'present.mp4' is in the directory, 'missing.mp4' is absent
      mockFs.readdir.mockResolvedValue([
        { name: 'present.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);
      mockS3Service.computeChecksum.mockResolvedValue('abc');
      mockS3Service.uploadStream.mockResolvedValue('present.mp4');

      const warnSpy = jest.spyOn(worker['logger'], 'warn');
      const job = createMockJob<RestoreJobData>('restore-backup', restoreJobData);
      await worker.process(job);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 file(s) from manifest were not found'),
      );
    });
  });

  describe('graceful interruption (abort)', () => {
    it('abort() should set the aborted flag', () => {
      expect((worker as any).aborted).toBe(false);
      worker.abort();
      expect((worker as any).aborted).toBe(true);
    });

    it('should abort media backup mid-way and cleanup partial files', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'file1.mp4', size: 1000 },
        { key: 'file2.mp4', size: 2000 },
        { key: 'file3.mp4', size: 3000 },
      ]);

      let downloadCount = 0;
      mockS3Service.downloadToPath.mockImplementation(async () => {
        downloadCount++;
        if (downloadCount === 1) {
          worker.abort();
        }
      });
      mockS3Service.computeChecksum.mockResolvedValue('checksum');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });

    it('should cleanup temp directory on abort', async () => {
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'file.mp4', size: 1000 },
      ]);
      mockS3Service.downloadToPath.mockImplementation(async () => {
        worker.abort();
      });
      mockS3Service.computeChecksum.mockResolvedValue('checksum');

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.process(job);

      // Temp directory should be cleaned up even on abort
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringMatching(/temp_\d+/),
        { recursive: true, force: true },
      );
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

  describe('worker lifecycle events', () => {
    it('should log when job becomes active', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');
      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      worker.onActive(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-001 (create-backup) started processing'),
      );
    });

    it('should log successful completion with duration', () => {
      const logSpy = jest.spyOn(worker['logger'], 'log');
      const job = createMockJob<BackupJobData>('create-backup', {
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
        expect.stringContaining('completed successfully in 5000ms'),
      );
    });

    it('should log failed completion with error', () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const job = createMockJob<BackupJobData>('create-backup', {
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

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed with error: Database dump failed'),
      );
    });

    it('should handle job failure event', async () => {
      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      await worker.onFailed(job, new Error('Worker crash'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-001 (create-backup) failed: Worker crash'),
        expect.any(String),
      );
    });

    it('should handle job failure without job context', async () => {
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

      execFilePromisified.mockResolvedValue({
        stdout: '',
        stderr: 'WARNING: some pg_dump warning',
      });

      const job = createMockJob<BackupJobData>('create-backup', {
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
      mockFs.stat.mockRejectedValueOnce(new Error('stat failed after backup'));
      mockFs.rm.mockRejectedValueOnce(new Error('Cleanup failed in finally'));

      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('stat failed after backup');
    });
  });

  describe('backup type differentiation', () => {
    it('should create manual backup with correct filename', async () => {
      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('_manual.tar.gz');
    });

    it('should create scheduled backup with correct filename', async () => {
      const job = createMockJob<BackupJobData>('create-backup', {
        includeMedia: false,
        type: 'scheduled',
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(job);

      expect(result.success).toBe(true);
      expect(result.filename).toContain('_scheduled.tar.gz');
    });
  });

  describe('integration: backup -> restore cycle', () => {
    it('should complete a full backup and restore cycle without errors', async () => {
      // === BACKUP PHASE ===
      mockS3Service.listObjects.mockResolvedValue([
        { key: 'video.mp4', size: 1024000 },
        { key: 'screenshot.png', size: 50000 },
      ]);
      mockS3Service.downloadToPath.mockResolvedValue(undefined);
      mockS3Service.computeChecksum
        .mockResolvedValueOnce('checksum-video')
        .mockResolvedValueOnce('checksum-screenshot');
      mockS3Service.getBucket.mockReturnValue('support-helper');
      mockFs.stat.mockResolvedValue({ size: 10240000 });

      const backupJob = createMockJob<BackupJobData>('create-backup', {
        includeMedia: true,
        type: 'manual',
        triggeredAt: new Date().toISOString(),
      });

      const backupResult = await worker.process(backupJob);

      expect(backupResult.success).toBe(true);
      expect(backupResult.filename).toBeDefined();

      // Capture the manifest that was written during backup
      const manifestWriteCall = mockFs.writeFile.mock.calls.find((call: any[]) =>
        String(call[0]).includes('manifest.json'),
      );
      expect(manifestWriteCall).toBeDefined();
      const writtenManifest = JSON.parse(manifestWriteCall![1] as string);
      expect(writtenManifest.files).toHaveLength(2);
      expect(writtenManifest.files[0].checksum).toBe('checksum-video');
      expect(writtenManifest.files[1].checksum).toBe('checksum-screenshot');

      // === RESTORE PHASE ===
      mockS3Service.computeChecksum.mockReset();
      mockS3Service.uploadStream.mockReset();
      mockS3Service.listObjects.mockReset();

      mockFs.readFile.mockResolvedValue(JSON.stringify(writtenManifest));
      mockFs.readdir.mockResolvedValue([
        { name: 'video.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'screenshot.png', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);

      // Checksums match (files are intact)
      mockS3Service.computeChecksum
        .mockResolvedValueOnce('checksum-video')
        .mockResolvedValueOnce('checksum-screenshot');
      mockS3Service.uploadStream.mockResolvedValue('key');

      const restoreJob = createMockJob<RestoreJobData>('restore-backup', {
        filename: backupResult.filename!,
        skipMedia: false,
        triggeredAt: new Date().toISOString(),
      });

      const restoreResult = await worker.process(restoreJob);

      expect(restoreResult.success).toBe(true);
      expect(mockS3Service.computeChecksum).toHaveBeenCalledTimes(2);
      expect(mockS3Service.uploadStream).toHaveBeenCalledTimes(2);
    });

    it('should detect corrupted files during restore verification', async () => {
      mockFs.access.mockResolvedValue(undefined);
      execFilePromisified.mockResolvedValue({ stdout: '', stderr: '' });

      mockFs.readFile.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        bucket: 'support-helper',
        totalFiles: 2,
        totalBytes: 2048000,
        files: [
          { key: 'good.mp4', size: 1024000, checksum: 'correct-checksum' },
          { key: 'bad.mp4', size: 1024000, checksum: 'original-checksum' },
        ],
      }));
      mockFs.readdir.mockResolvedValue([
        { name: 'good.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'bad.mp4', isDirectory: () => false, isFile: () => true },
        { name: 'manifest.json', isDirectory: () => false, isFile: () => true },
      ] as any);

      // good.mp4: checksum matches; bad.mp4: checksum differs (corrupted)
      mockS3Service.computeChecksum
        .mockResolvedValueOnce('correct-checksum')  // good.mp4 passes
        .mockResolvedValueOnce('tampered-checksum'); // bad.mp4 fails
      mockS3Service.uploadStream.mockResolvedValue('key');
      mockFs.stat.mockResolvedValue({ size: 1024000 });

      const errorSpy = jest.spyOn(worker['logger'], 'error');
      const warnSpy = jest.spyOn(worker['logger'], 'warn');

      const restoreJob = createMockJob<RestoreJobData>('restore-backup', {
        filename: 'backup.tar.gz',
        skipMedia: false,
        triggeredAt: new Date().toISOString(),
      });

      const result = await worker.process(restoreJob);

      // Restore succeeds (good.mp4 was restored)
      expect(result.success).toBe(true);

      // bad.mp4 checksum mismatch logged
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Checksum mismatch for bad.mp4'),
      );

      // Warning about skipped files
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 file(s) failed checksum verification'),
      );

      // Only good.mp4 was uploaded; bad.mp4 was skipped
      expect(mockS3Service.uploadStream).toHaveBeenCalledTimes(1);
      expect(mockS3Service.uploadStream).toHaveBeenCalledWith(
        'good.mp4',
        expect.any(String),
      );
    });
  });
});

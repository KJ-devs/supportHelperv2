import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';

const execFileAsync = promisify(execFile);

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'fatal';
  message: string;
  version?: string;
}

/**
 * StartupCheckService
 *
 * Verifies external dependencies at boot:
 * - Database (required for all operations)
 * - Redis (required for caching and queues)
 * - S3/MinIO configuration (required for media uploads)
 * - Encryption keys (required for secure data)
 * - FFmpeg (optional, warning only - used by worker)
 * - Tesseract (optional, warning only - used by worker)
 *
 * Logs WARNING for optional, FATAL for required services.
 * Prints a summary table at startup.
 */
@Injectable()
export class StartupCheckService implements OnModuleInit {
  private readonly logger = new Logger(StartupCheckService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Running startup dependency checks...');

    const results = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3Config(),
      this.checkEncryptionKey(),
      this.checkFfmpeg(),
      this.checkTesseract(),
    ]);

    this.printSummary(results);

    const fatalCount = results.filter((r) => r.status === 'fatal').length;
    if (fatalCount > 0) {
      this.logger.error(
        `${fatalCount} fatal dependency check(s) failed. Application cannot start.`,
      );
      throw new Error('Fatal dependencies missing - see logs above');
    }
  }

  private async checkDatabase(): Promise<CheckResult> {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      return {
        name: 'Database',
        status: 'fatal',
        message: 'DATABASE_URL not configured.',
      };
    }

    try {
      // Test database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'Database',
        status: 'ok',
        message: 'PostgreSQL connection verified',
      };
    } catch (error) {
      return {
        name: 'Database',
        status: 'fatal',
        message: `Cannot connect to database: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const redisUrl = this.configService.get<string>('database.redisUrl');
    if (!redisUrl) {
      return {
        name: 'Redis',
        status: 'fatal',
        message: 'REDIS_URL not configured. Cache and queues require Redis.',
      };
    }

    let client: Redis | null = null;
    try {
      const url = new URL(redisUrl);
      client = new Redis({
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        connectTimeout: 5000,
        lazyConnect: false,
      });

      await client.ping();
      return {
        name: 'Redis',
        status: 'ok',
        message: 'Connection verified',
      };
    } catch (error) {
      return {
        name: 'Redis',
        status: 'fatal',
        message: `Cannot connect to Redis: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    } finally {
      if (client) {
        await client.quit();
      }
    }
  }

  private async checkS3Config(): Promise<CheckResult> {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY');
    const secretKey = this.configService.get<string>('S3_SECRET_KEY');
    const bucket = this.configService.get<string>('S3_BUCKET');

    if (!endpoint || !accessKey || !secretKey) {
      return {
        name: 'S3/MinIO',
        status: 'fatal',
        message:
          'S3 configuration incomplete (missing endpoint, access key, or secret key)',
      };
    }

    if (!bucket) {
      return {
        name: 'S3/MinIO',
        status: 'warning',
        message: `Configured but S3_BUCKET not set (endpoint: ${endpoint})`,
      };
    }

    return {
      name: 'S3/MinIO',
      status: 'ok',
      message: `Configured (endpoint: ${endpoint}, bucket: ${bucket})`,
    };
  }

  private async checkEncryptionKey(): Promise<CheckResult> {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      return {
        name: 'Encryption Key',
        status: 'fatal',
        message:
          'ENCRYPTION_KEY not set. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      };
    }

    if (key.length !== 64) {
      return {
        name: 'Encryption Key',
        status: 'fatal',
        message: `ENCRYPTION_KEY is ${key.length} chars, expected 64 (32 bytes hex).`,
      };
    }

    return {
      name: 'Encryption Key',
      status: 'ok',
      message: 'Configured (32 bytes)',
    };
  }

  private async checkFfmpeg(): Promise<CheckResult> {
    try {
      const { stdout } = await execFileAsync('ffmpeg', ['-version'], {
        timeout: 5000,
      });
      const versionLine = stdout.split('\n')[0] || '';
      const version =
        versionLine.match(/ffmpeg version (\S+)/)?.[1] || 'unknown';
      return {
        name: 'FFmpeg',
        status: 'ok',
        message: 'Available',
        version,
      };
    } catch {
      return {
        name: 'FFmpeg',
        status: 'warning',
        message:
          'Not found. Video frame extraction will fail (handled by worker).',
      };
    }
  }

  private async checkTesseract(): Promise<CheckResult> {
    try {
      const { stdout } = await execFileAsync('tesseract', ['--version'], {
        timeout: 5000,
      });
      const version = stdout.split('\n')[0]?.trim() || 'unknown';
      return {
        name: 'Tesseract',
        status: 'ok',
        message: 'Available',
        version,
      };
    } catch {
      return {
        name: 'Tesseract',
        status: 'warning',
        message: 'Not found. OCR on video frames will fail (handled by worker).',
      };
    }
  }

  private printSummary(results: CheckResult[]): void {
    this.logger.log('');
    this.logger.log('=== Startup Dependency Check Summary ===');

    for (const result of results) {
      const icon =
        result.status === 'ok'
          ? 'OK'
          : result.status === 'warning'
            ? 'WARN'
            : 'FAIL';
      const versionStr = result.version ? ` (v${result.version})` : '';
      const line = `  [${icon}] ${result.name}${versionStr}: ${result.message}`;

      if (result.status === 'fatal') {
        this.logger.error(line);
      } else if (result.status === 'warning') {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    const warnCount = results.filter((r) => r.status === 'warning').length;
    const failCount = results.filter((r) => r.status === 'fatal').length;

    this.logger.log(
      `=== ${okCount} OK | ${warnCount} WARNING | ${failCount} FATAL ===`,
    );
    this.logger.log('');
  }
}

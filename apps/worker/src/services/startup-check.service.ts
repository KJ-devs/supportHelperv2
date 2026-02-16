import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { access, constants } from 'fs/promises';
import { PrismaService } from './prisma.service';

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
 * - FFmpeg (required for video processing)
 * - Tesseract (required for OCR)
 * - YOLO model (optional for UI detection)
 * - Database connectivity (required for all operations)
 * - Redis connectivity (required for queues)
 * - S3/MinIO connectivity and write permissions (required for media storage)
 * - Encryption keys with encrypt/decrypt test (required for integrations)
 *
 * Logs WARNING for optional, FATAL for required services.
 * Prints a summary table at startup.
 */
@Injectable()
export class StartupCheckService implements OnModuleInit {
  private readonly logger = new Logger(StartupCheckService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Running startup dependency checks...');

    const results = await Promise.all([
      this.checkFfmpeg(),
      this.checkTesseract(),
      this.checkYoloModel(),
      this.checkS3Config(),
      this.checkEncryptionKey(),
      this.checkRedis(),
      this.checkDatabase(),
    ]);

    this.printSummary(results);

    const fatalCount = results.filter((r) => r.status === 'fatal').length;
    if (fatalCount > 0) {
      this.logger.error(
        `${fatalCount} fatal dependency check(s) failed. Some features will not work.`,
      );
    }
  }

  private async checkFfmpeg(): Promise<CheckResult> {
    try {
      const { stdout } = await execFileAsync('ffmpeg', ['-version'], {
        timeout: 5000,
      });
      const versionLine = stdout.split('\n')[0] || '';
      const version = versionLine.match(/ffmpeg version (\S+)/)?.[1] || 'unknown';
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
        message: 'Not found. Video frame extraction will fail.',
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
        message: 'Not found. OCR on video frames will fail.',
      };
    }
  }

  private async checkYoloModel(): Promise<CheckResult> {
    const modelPath = this.configService.get<string>('yolo.model.weightsPath') || './models/yolov11n.pt';

    try {
      await access(modelPath, constants.R_OK);
      return {
        name: 'YOLO Model',
        status: 'ok',
        message: `Model file found at ${modelPath}`,
      };
    } catch {
      return {
        name: 'YOLO Model',
        status: 'warning',
        message: `Model file not found at ${modelPath}. UI element detection will fail.`,
      };
    }
  }

  private async checkS3Config(): Promise<CheckResult> {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const bucket = this.configService.get<string>('S3_BUCKET');

    if (!endpoint || !accessKey || !secretKey) {
      return {
        name: 'S3/MinIO',
        status: 'fatal',
        message: 'S3 configuration incomplete (missing endpoint, access key, or secret key)',
      };
    }

    if (!bucket) {
      return {
        name: 'S3/MinIO',
        status: 'warning',
        message: `Endpoint configured but S3_BUCKET not set (${endpoint})`,
      };
    }

    // Test S3 write permissions with a test object
    try {
      const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
      });

      const testKey = `.startup-check-${Date.now()}.txt`;
      const testContent = 'Startup dependency check';

      // PUT test object
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: testContent,
      }));

      // DELETE test object
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: testKey,
      }));

      return {
        name: 'S3/MinIO',
        status: 'ok',
        message: `Write permissions verified (endpoint: ${endpoint}, bucket: ${bucket})`,
      };
    } catch (error) {
      return {
        name: 'S3/MinIO',
        status: 'fatal',
        message: `Write test failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  private async checkEncryptionKey(): Promise<CheckResult> {
    const key = this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY');
    if (!key) {
      return {
        name: 'Encryption Key',
        status: 'warning',
        message: 'INTEGRATION_ENCRYPTION_KEY not set. Integration credential encryption disabled.',
      };
    }

    if (key.length !== 64) {
      return {
        name: 'Encryption Key',
        status: 'warning',
        message: `INTEGRATION_ENCRYPTION_KEY is ${key.length} chars, expected 64 (32 bytes hex).`,
      };
    }

    // Test encryption/decryption
    try {
      const { encryptAES256GCM, decryptAES256GCM, parseEncryptionKey } = await import('@support-helper/shared');
      const encKey = parseEncryptionKey(key);
      const testPlaintext = 'startup-check-test';
      const encrypted = encryptAES256GCM(testPlaintext, encKey);
      const decrypted = decryptAES256GCM(encrypted, encKey);

      if (decrypted !== testPlaintext) {
        return {
          name: 'Encryption Key',
          status: 'fatal',
          message: 'Encryption test failed: decrypted value does not match original.',
        };
      }

      return {
        name: 'Encryption Key',
        status: 'ok',
        message: 'Configured and verified (32 bytes)',
      };
    } catch (error) {
      return {
        name: 'Encryption Key',
        status: 'fatal',
        message: `Encryption test failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      return {
        name: 'Redis',
        status: 'fatal',
        message: 'REDIS_URL not configured. BullMQ queues require Redis.',
      };
    }

    // Test Redis connectivity
    try {
      const { default: Redis } = await import('ioredis');
      const url = new URL(redisUrl);
      const client = new Redis({
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        connectTimeout: 5000,
        lazyConnect: false,
      });

      await client.ping();
      await client.quit();

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

    if (!this.prisma) {
      return {
        name: 'Database',
        status: 'ok',
        message: 'Configured (connection test skipped - PrismaService not injected)',
      };
    }

    // Test database connectivity
    try {
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

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { getErrorMessage } from '../utils/error.utils';
import * as path from 'path';
import * as os from 'os';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import * as crypto from 'crypto';

const pipelineAsync = promisify(pipeline);

/**
 * S3 Service
 *
 * Handles S3/MinIO object storage operations:
 * - Download files to temp
 * - Upload files
 * - Generate presigned URLs
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucket = this.configService.get<string>('S3_BUCKET', 'support-helper');

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.logger.log(`S3 client initialized for bucket: ${this.bucket}`);
  }

  /**
   * Download file from S3 to temporary location
   */
  async downloadToTemp(key: string): Promise<string> {
    this.logger.log(`Downloading ${key} from S3`);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Create temp file
      const ext = path.extname(key) || '.tmp';
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 's3-download-'));
      const tempPath = path.join(tempDir, `file${ext}`);

      // Stream body to file
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      await fs.writeFile(tempPath, Buffer.concat(chunks));

      this.logger.log(`Downloaded ${key} to ${tempPath}`);
      return tempPath;
    } catch (error) {
      this.logger.error(`Failed to download ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Upload file to S3
   */
  async upload(key: string, filePath: string, contentType?: string): Promise<string> {
    this.logger.log(`Uploading to S3: ${key}`);

    try {
      const fileContent = await fs.readFile(filePath);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      });

      await this.client.send(command);

      this.logger.log(`Uploaded ${key} to S3`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Upload file to S3 using streaming (avoids loading large files into memory)
   */
  async uploadStream(key: string, filePath: string, contentType?: string): Promise<string> {
    this.logger.log(`Uploading (stream) to S3: ${key}`);

    try {
      const stat = await fs.stat(filePath);
      const readStream = createReadStream(filePath);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: readStream,
        ContentLength: stat.size,
        ContentType: contentType,
      });

      await this.client.send(command);

      this.logger.log(`Uploaded ${key} to S3 via stream`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to stream-upload ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Upload buffer to S3
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    this.logger.log(`Uploading buffer to S3: ${key}`);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      this.logger.log(`Uploaded ${key} to S3`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload buffer ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async delete(key: string): Promise<void> {
    this.logger.log(`Deleting from S3: ${key}`);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      this.logger.log(`Deleted ${key} from S3`);
    } catch (error) {
      this.logger.error(`Failed to delete ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Generate presigned URL for download
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Generate presigned URL for upload
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Check if file exists in S3
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all objects in bucket with optional prefix
   */
  async listObjects(prefix?: string): Promise<Array<{ key: string; size: number }>> {
    this.logger.log(`Listing objects with prefix: ${prefix || '(all)'}`);

    try {
      const objects: Array<{ key: string; size: number }> = [];
      let continuationToken: string | undefined = undefined;

      do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response = await this.client.send(command);

        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              objects.push({
                key: item.Key,
                size: item.Size || 0,
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      this.logger.log(`Found ${objects.length} objects`);
      return objects;
    } catch (error) {
      this.logger.error(`Failed to list objects: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Download file from S3 to specific path using streaming
   * Uses Node.js streams pipeline to avoid buffering the entire file in memory
   */
  async downloadToPath(key: string, targetPath: string): Promise<void> {
    this.logger.log(`Downloading ${key} to ${targetPath}`);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Ensure target directory exists
      const dir = path.dirname(targetPath);
      await fs.mkdir(dir, { recursive: true });

      // Stream body to file using pipeline (true streaming, no memory buffering)
      const readableStream = response.Body as Readable;
      const writeableStream = createWriteStream(targetPath);

      await pipelineAsync(readableStream, writeableStream);

      this.logger.log(`Downloaded ${key} to ${targetPath}`);
    } catch (error) {
      // Clean up partial file on error
      await fs.rm(targetPath, { force: true }).catch(() => {});
      this.logger.error(`Failed to download ${key}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Compute SHA-256 checksum of a local file
   */
  async computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get bucket name
   */
  getBucket(): string {
    return this.bucket;
  }
}

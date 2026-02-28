import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUrlResponse {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get('s3.endpoint');
    const accessKeyId = this.config.get('s3.accessKeyId');
    const secretAccessKey = this.config.get('s3.secretAccessKey');
    this.bucket = this.config.get('s3.bucket') || 'default-bucket';
    this.region = this.config.get('s3.region') || 'us-east-1';

    this.s3Client = new S3Client({
      endpoint,
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.logger.log('S3Service initialized');
  }

  /**
   * Generate presigned URL for upload
   * @param key Object key in S3
   * @param contentType MIME type
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600,
  ): Promise<PresignedUrlResponse> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.debug(`Generated presigned upload URL for key: ${key}`);

      return {
        uploadUrl,
        storageKey: key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Failed to generate presigned upload URL', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for download
   * @param key Object key in S3
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @param contentType Optional MIME type to set via ResponseContentType
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
    contentType?: string,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(contentType && { ResponseContentType: contentType }),
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      this.logger.debug(`Generated presigned download URL for key: ${key}${contentType ? ` with Content-Type: ${contentType}` : ''}`);

      return url;
    } catch (error) {
      this.logger.error('Failed to generate presigned download URL', error);
      throw error;
    }
  }

  /**
   * Check if object exists in S3
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(key: string) {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
        etag: response.ETag?.replace(/"/g, ''), // Remove quotes from ETag
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete object from S3
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      this.logger.log(`Deleted object: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object: ${key}`, error);
      throw error;
    }
  }

  /**
   * Generate unique storage key
   * Format: {tenantId}/{ticketId}/{uuid}.{extension}
   */
  generateStorageKey(
    tenantId: string,
    ticketId: string,
    filename: string,
  ): string {
    const extension = filename.split('.').pop();
    const uuid = randomUUID();
    return `${tenantId}/${ticketId}/${uuid}.${extension}`;
  }

  /**
   * Get public URL for object (for MinIO console access)
   */
  getPublicUrl(key: string): string {
    const endpoint = this.config.get('s3.endpoint');
    return `${endpoint}/${this.bucket}/${key}`;
  }
}

import { registerAs } from '@nestjs/config';

/**
 * S3/MinIO configuration
 */
export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true, // Required for MinIO
}));

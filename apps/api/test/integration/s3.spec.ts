import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * S3 Integration Tests
 *
 * Tests S3 operations with a real S3/MinIO instance.
 * Requires TEST_S3_ENDPOINT, TEST_S3_ACCESS_KEY, TEST_S3_SECRET_KEY environment variables.
 */

const isIntegrationTest = !!process.env.TEST_S3_ENDPOINT && !!process.env.TEST_S3_ACCESS_KEY;

(isIntegrationTest ? describe : describe.skip)('S3 Integration', () => {
  let s3Client: S3Client;
  const testBucket = process.env.TEST_S3_BUCKET || 'test-bucket';

  beforeAll(async () => {
    s3Client = new S3Client({
      endpoint: process.env.TEST_S3_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.TEST_S3_ACCESS_KEY!,
        secretAccessKey: process.env.TEST_S3_SECRET_KEY!,
      },
      forcePathStyle: true, // Required for MinIO
    });
  });

  afterAll(async () => {
    s3Client.destroy();
  });

  describe('Object Operations', () => {
    const testKey = `test-${Date.now()}.txt`;
    const testContent = 'Hello, World!';

    afterAll(async () => {
      // Cleanup
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: testBucket,
            Key: testKey,
          })
        );
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it('should upload an object', async () => {
      const result = await s3Client.send(
        new PutObjectCommand({
          Bucket: testBucket,
          Key: testKey,
          Body: testContent,
          ContentType: 'text/plain',
        })
      );

      expect(result.$metadata.httpStatusCode).toBe(200);
    });

    it('should retrieve an object', async () => {
      // First upload
      await s3Client.send(
        new PutObjectCommand({
          Bucket: testBucket,
          Key: testKey,
          Body: testContent,
          ContentType: 'text/plain',
        })
      );

      // Then retrieve
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: testBucket,
          Key: testKey,
        })
      );

      const body = await result.Body?.transformToString();
      expect(body).toBe(testContent);
    });

    it('should delete an object', async () => {
      // Upload
      await s3Client.send(
        new PutObjectCommand({
          Bucket: testBucket,
          Key: testKey,
          Body: testContent,
        })
      );

      // Delete
      const result = await s3Client.send(
        new DeleteObjectCommand({
          Bucket: testBucket,
          Key: testKey,
        })
      );

      expect(result.$metadata.httpStatusCode).toBe(204);

      // Verify deleted
      await expect(
        s3Client.send(
          new GetObjectCommand({
            Bucket: testBucket,
            Key: testKey,
          })
        )
      ).rejects.toThrow();
    });
  });

  describe('Media File Operations', () => {
    it('should upload video file with metadata', async () => {
      const videoKey = `videos/test-${Date.now()}.webm`;
      const metadata = {
        'x-amz-meta-tenant-id': 'tenant-123',
        'x-amz-meta-ticket-id': 'ticket-456',
      };

      const result = await s3Client.send(
        new PutObjectCommand({
          Bucket: testBucket,
          Key: videoKey,
          Body: Buffer.from('fake video content'),
          ContentType: 'video/webm',
          Metadata: {
            tenantId: 'tenant-123',
            ticketId: 'ticket-456',
          },
        })
      );

      expect(result.$metadata.httpStatusCode).toBe(200);

      // Cleanup
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: testBucket,
          Key: videoKey,
        })
      );
    });
  });
});

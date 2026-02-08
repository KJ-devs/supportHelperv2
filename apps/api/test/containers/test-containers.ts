/**
 * Test Containers Configuration
 *
 * Provides Docker containers for integration tests.
 * Requires Docker to be running.
 */

import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface TestContainersConfig {
  postgres?: StartedTestContainer;
  redis?: StartedTestContainer;
  minio?: StartedTestContainer;
}

let containers: TestContainersConfig = {};

/**
 * Start PostgreSQL container for testing
 */
export async function startPostgres(): Promise<StartedTestContainer> {
  if (containers.postgres) {
    return containers.postgres;
  }

  console.log('🐘 Starting PostgreSQL container...');

  const container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test_db',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  containers.postgres = container;

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  process.env.TEST_DATABASE_URL = `postgresql://test:test@${host}:${port}/test_db`;

  console.log(`✅ PostgreSQL running on port ${port}`);

  return container;
}

/**
 * Start Redis container for testing
 */
export async function startRedis(): Promise<StartedTestContainer> {
  if (containers.redis) {
    return containers.redis;
  }

  console.log('🔴 Starting Redis container...');

  const container = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  containers.redis = container;

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  process.env.TEST_REDIS_URL = `redis://${host}:${port}`;

  console.log(`✅ Redis running on port ${port}`);

  return container;
}

/**
 * Start MinIO (S3-compatible) container for testing
 */
export async function startMinIO(): Promise<StartedTestContainer> {
  if (containers.minio) {
    return containers.minio;
  }

  console.log('📦 Starting MinIO container...');

  const container = await new GenericContainer('minio/minio:latest')
    .withEnvironment({
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
    })
    .withExposedPorts(9000)
    .withCommand(['server', '/data'])
    .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
    .start();

  containers.minio = container;

  const host = container.getHost();
  const port = container.getMappedPort(9000);
  process.env.TEST_S3_ENDPOINT = `http://${host}:${port}`;
  process.env.TEST_S3_ACCESS_KEY = 'minioadmin';
  process.env.TEST_S3_SECRET_KEY = 'minioadmin';
  process.env.TEST_S3_BUCKET = 'test-bucket';

  console.log(`✅ MinIO running on port ${port}`);

  // Create test bucket
  await createTestBucket(host, port);

  return container;
}

/**
 * Create test bucket in MinIO
 */
async function createTestBucket(host: string, port: number): Promise<void> {
  const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');

  const s3 = new S3Client({
    endpoint: `http://${host}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
    forcePathStyle: true,
  });

  try {
    await s3.send(new CreateBucketCommand({ Bucket: 'test-bucket' }));
    console.log('✅ Test bucket created');
  } catch (error: any) {
    if (error.name !== 'BucketAlreadyOwnedByYou') {
      console.warn('⚠️ Could not create test bucket:', error.message);
    }
  }

  s3.destroy();
}

/**
 * Start all test containers
 */
export async function startAllContainers(): Promise<TestContainersConfig> {
  console.log('🚀 Starting test containers...');

  await Promise.all([startPostgres(), startRedis(), startMinIO()]);

  console.log('✅ All test containers started');

  return containers;
}

/**
 * Stop all test containers
 */
export async function stopAllContainers(): Promise<void> {
  console.log('🛑 Stopping test containers...');

  const stopPromises: Promise<void>[] = [];

  if (containers.postgres) {
    stopPromises.push(containers.postgres.stop());
  }
  if (containers.redis) {
    stopPromises.push(containers.redis.stop());
  }
  if (containers.minio) {
    stopPromises.push(containers.minio.stop());
  }

  await Promise.all(stopPromises);

  containers = {};

  console.log('✅ All test containers stopped');
}

/**
 * Get database URL for tests
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL;
}

/**
 * Get Redis URL for tests
 */
export function getRedisUrl(): string | undefined {
  return process.env.TEST_REDIS_URL;
}

/**
 * Get S3 endpoint for tests
 */
export function getS3Config(): {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
} {
  return {
    endpoint: process.env.TEST_S3_ENDPOINT,
    accessKey: process.env.TEST_S3_ACCESS_KEY,
    secretKey: process.env.TEST_S3_SECRET_KEY,
    bucket: process.env.TEST_S3_BUCKET,
  };
}

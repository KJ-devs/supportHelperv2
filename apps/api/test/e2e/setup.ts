import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

/**
 * E2E Test Setup
 *
 * Full application tests with all dependencies.
 * Requires all services running (DB, Redis, S3).
 */

// Check if E2E environment is configured
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
];

export function isE2EEnvironmentReady(): boolean {
  return REQUIRED_ENV_VARS.every((v) => process.env[v]);
}

export const E2E_SKIP_MESSAGE =
  'E2E tests skipped: Required environment variables not set. Run `pnpm docker:up` first.';

export interface E2ETestContext {
  app: INestApplication;
  cleanup: () => Promise<void>;
}

export async function setupE2ETest(appModule: any): Promise<E2ETestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [appModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.init();

  const cleanup = async () => {
    await app.close();
  };

  return { app, cleanup };
}

// Auth helper for E2E tests
export class AuthHelper {
  constructor(private app: INestApplication) {}

  async register(data: { email: string; password: string; name: string; tenantName: string }) {
    const response = await request(this.app.getHttpServer())
      .post('/auth/register')
      .send(data)
      .expect(201);

    return response.body;
  }

  async login(email: string, password: string) {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body;
  }

  getAuthHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }
}

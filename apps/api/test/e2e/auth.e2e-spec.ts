import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isE2EEnvironmentReady, E2E_SKIP_MESSAGE, setupE2ETest, AuthHelper, E2ETestContext } from './setup';

/**
 * Auth E2E Tests
 *
 * Tests the full authentication flow including:
 * - User registration
 * - User login
 * - Token validation
 * - Protected routes
 */

const shouldRun = isE2EEnvironmentReady();

(shouldRun ? describe : describe.skip)('Auth (E2E)', () => {
  let ctx: E2ETestContext;
  let authHelper: AuthHelper;
  let AppModule: any;

  const testUser = {
    email: `e2e-auth-${Date.now()}@test.com`,
    password: 'SecurePassword123!',
    name: 'E2E Test User',
    tenantName: 'E2E Test Tenant',
  };

  beforeAll(async () => {
    // Dynamic import to avoid loading AppModule when tests are skipped
    const appModuleImport = await import('../../src/app.module');
    AppModule = appModuleImport.AppModule;
    ctx = await setupE2ETest(AppModule);
    authHelper = new AuthHelper(ctx.app);
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.name).toBe(testUser.name);
    });

    it('should reject duplicate email', async () => {
      await request(ctx.app.getHttpServer()).post('/auth/register').send(testUser).expect(409);
    });

    it('should reject invalid email', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser,
          email: `e2e-short-${Date.now()}@test.com`,
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should reject invalid email', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should reject invalid password', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong-password',
        })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const loginResponse = await authHelper.login(testUser.email, testUser.password);
      accessToken = loginResponse.accessToken;
    });

    it('should return current user with valid token', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/auth/me')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      await request(ctx.app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(ctx.app.getHttpServer())
        .get('/auth/me')
        .set(authHelper.getAuthHeader('invalid-token'))
        .expect(401);
    });
  });
});

if (!shouldRun) {
  describe('Auth (E2E) - SKIPPED', () => {
    it(E2E_SKIP_MESSAGE, () => {
      console.log(E2E_SKIP_MESSAGE);
    });
  });
}

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isE2EEnvironmentReady, E2E_SKIP_MESSAGE, setupE2ETest, AuthHelper, E2ETestContext } from './setup';

/**
 * Applications E2E Tests
 *
 * Tests the full application management flow including:
 * - Creating applications
 * - Listing applications
 * - Updating applications
 * - Deleting applications
 * - SDK key regeneration
 */

const shouldRun = isE2EEnvironmentReady();

(shouldRun ? describe : describe.skip)('Applications (E2E)', () => {
  let ctx: E2ETestContext;
  let authHelper: AuthHelper;
  let accessToken: string;
  let createdAppId: string;

  const testUser = {
    email: `e2e-apps-${Date.now()}@test.com`,
    password: 'SecurePassword123!',
    name: 'E2E Apps User',
    tenantName: 'E2E Apps Tenant',
  };

  beforeAll(async () => {
    // Dynamic import to avoid loading AppModule when tests are skipped
    const { AppModule } = await import('../../src/app.module');
    ctx = await setupE2ETest(AppModule);
    authHelper = new AuthHelper(ctx.app);

    // Register and get token
    const authResponse = await authHelper.register(testUser);
    accessToken = authResponse.accessToken;
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  describe('POST /applications', () => {
    it('should create an application', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/applications')
        .set(authHelper.getAuthHeader(accessToken))
        .send({
          name: 'Test Application',
          platform: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('sdkKey');
      expect(response.body.name).toBe('Test Application');

      createdAppId = response.body.id;
    });

    it('should reject without authentication', async () => {
      await request(ctx.app.getHttpServer())
        .post('/applications')
        .send({ name: 'Test App' })
        .expect(401);
    });

    it('should reject without name', async () => {
      await request(ctx.app.getHttpServer())
        .post('/applications')
        .set(authHelper.getAuthHeader(accessToken))
        .send({ platform: 'web' })
        .expect(400);
    });
  });

  describe('GET /applications', () => {
    it('should list all applications', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/applications')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /applications/:id', () => {
    it('should get a specific application', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/applications/${createdAppId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.id).toBe(createdAppId);
    });

    it('should return 404 for non-existent application', async () => {
      await request(ctx.app.getHttpServer())
        .get('/applications/00000000-0000-0000-0000-000000000000')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(404);
    });
  });

  describe('PATCH /applications/:id', () => {
    it('should update an application', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/applications/${createdAppId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .send({ name: 'Updated Application' })
        .expect(200);

      expect(response.body.name).toBe('Updated Application');
    });
  });

  describe('POST /applications/:id/regenerate-key', () => {
    it('should regenerate SDK key', async () => {
      const originalApp = await request(ctx.app.getHttpServer())
        .get(`/applications/${createdAppId}`)
        .set(authHelper.getAuthHeader(accessToken));

      const response = await request(ctx.app.getHttpServer())
        .post(`/applications/${createdAppId}/regenerate-key`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.sdkKey).not.toBe(originalApp.body.sdkKey);
    });
  });

  describe('DELETE /applications/:id', () => {
    it('should delete an application', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/applications/${createdAppId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      // Verify deleted
      await request(ctx.app.getHttpServer())
        .get(`/applications/${createdAppId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(404);
    });
  });
});

if (!shouldRun) {
  describe('Applications (E2E) - SKIPPED', () => {
    it(E2E_SKIP_MESSAGE, () => {
      console.log(E2E_SKIP_MESSAGE);
    });
  });
}

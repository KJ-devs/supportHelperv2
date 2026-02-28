import request from 'supertest';
import {
  isE2EEnvironmentReady,
  E2E_SKIP_MESSAGE,
  setupE2ETest,
  AuthHelper,
  E2ETestContext,
} from './setup';

/**
 * Media Download Cross-Tenant Isolation E2E Tests (US-SEC-01)
 *
 * Regression tests that verify the tenant isolation implemented in
 * MediaService.getDownloadUrlByStorageKey():
 *
 * - Tenant A CAN download their own media via GET /media/download/*
 * - Tenant B gets 404 when attempting to download Tenant A's media
 *
 * The production guard is the Prisma query which filters by BOTH storageKey
 * AND ticket.tenantId, so a cross-tenant request will find no record and the
 * service throws NotFoundException (HTTP 404).
 */

const shouldRun = isE2EEnvironmentReady();

(shouldRun ? describe : describe.skip)(
  'Media Download Cross-Tenant Isolation (E2E)',
  () => {
    let ctx: E2ETestContext;
    let authHelper: AuthHelper;

    // Tenant A state
    let tokenA: string;
    let applicationIdA: string;
    let ticketIdA: string;
    let mediaIdA: string;
    let storageKeyA: string;

    // Tenant B state
    let tokenB: string;

    const userA = {
      email: `e2e-media-a-${Date.now()}@test.com`,
      password: 'SecurePassword123!',
      name: 'E2E Media Tenant A',
      tenantName: 'E2E Media Tenant A',
    };

    const userB = {
      email: `e2e-media-b-${Date.now()}@test.com`,
      password: 'SecurePassword123!',
      name: 'E2E Media Tenant B',
      tenantName: 'E2E Media Tenant B',
    };

    beforeAll(async () => {
      const { AppModule } = await import('../../src/app.module');
      ctx = await setupE2ETest(AppModule);
      authHelper = new AuthHelper(ctx.app);

      // Register Tenant A and Tenant B as independent tenants
      const responseA = await authHelper.register(userA);
      tokenA = responseA.accessToken;

      const responseB = await authHelper.register(userB);
      tokenB = responseB.accessToken;

      // Tenant A: create an application
      const appResponse = await request(ctx.app.getHttpServer())
        .post('/applications')
        .set(authHelper.getAuthHeader(tokenA))
        .send({ name: 'Media Test App A', platform: 'web' })
        .expect(201);

      applicationIdA = appResponse.body.id;

      // Tenant A: create a ticket (required for media upload)
      const ticketResponse = await request(ctx.app.getHttpServer())
        .post('/tickets')
        .set(authHelper.getAuthHeader(tokenA))
        .send({
          applicationId: applicationIdA,
          title: 'Media isolation test ticket',
          description: 'Ticket used to attach media for cross-tenant test',
          type: 'bug',
          severity: 'low',
        })
        .expect(201);

      ticketIdA = ticketResponse.body.id;

      // Tenant A: request a presigned upload URL, which also creates a media
      // record scoped to their tenant.  We only need the media record in the
      // database — we do NOT need to upload an actual file to S3 because the
      // download endpoint calls getDownloadUrlByStorageKey() which hits Prisma
      // first (tenant isolation check) before ever touching S3.
      const uploadUrlResponse = await request(ctx.app.getHttpServer())
        .post('/media/presigned-url')
        .set(authHelper.getAuthHeader(tokenA))
        .send({
          ticketId: ticketIdA,
          type: 'image',
          filename: 'screenshot.png',
          size: 50000,
          contentType: 'image/png',
        })
        .expect(201);

      mediaIdA = uploadUrlResponse.body.mediaId;
      storageKeyA = uploadUrlResponse.body.storageKey;
    });

    afterAll(async () => {
      if (ctx) {
        await ctx.cleanup();
      }
    });

    describe('GET /media/download/:storageKey', () => {
      it('should allow Tenant A to access their own media (redirect or 200)', async () => {
        // The endpoint redirects to a presigned S3 URL.  In a test environment
        // without a real S3 bucket the presigned URL generation may itself fail
        // (503 / 500) but the important thing is it does NOT return 404 from the
        // tenant-isolation guard.  We accept 2xx or 3xx as "allowed access".
        //
        // supertest follows redirects by default when using .redirects(1); here
        // we deliberately do NOT follow redirects so we can inspect the 302
        // response directly.
        const response = await request(ctx.app.getHttpServer())
          .get(`/media/download/${storageKeyA}`)
          .set(authHelper.getAuthHeader(tokenA))
          .redirects(0);

        // 302 (redirect to presigned URL) or 200 are both acceptable.
        // The key assertion: NOT 404, which would indicate tenant isolation fired.
        expect([200, 302, 307, 308]).toContain(response.status);
      });

      it('should return 404 when Tenant B tries to download Tenant A media', async () => {
        // Tenant B uses their own valid JWT, but the storageKey belongs to
        // Tenant A.  The Prisma query filters by tenantId from the JWT, so it
        // finds no record and throws NotFoundException → HTTP 404.
        const response = await request(ctx.app.getHttpServer())
          .get(`/media/download/${storageKeyA}`)
          .set(authHelper.getAuthHeader(tokenB))
          .redirects(0);

        expect(response.status).toBe(404);
      });

      it('should return 401 when no auth token is provided', async () => {
        const response = await request(ctx.app.getHttpServer())
          .get(`/media/download/${storageKeyA}`)
          .redirects(0);

        expect(response.status).toBe(401);
      });

      it('should return 404 for a completely unknown storage key', async () => {
        const fakeKey = 'tenant-unknown/ticket-unknown/nonexistent.mp4';

        const response = await request(ctx.app.getHttpServer())
          .get(`/media/download/${fakeKey}`)
          .set(authHelper.getAuthHeader(tokenA))
          .redirects(0);

        expect(response.status).toBe(404);
      });
    });
  },
);

if (!shouldRun) {
  describe('Media Download Cross-Tenant Isolation (E2E) - SKIPPED', () => {
    it(E2E_SKIP_MESSAGE, () => {
      console.log(E2E_SKIP_MESSAGE);
    });
  });
}

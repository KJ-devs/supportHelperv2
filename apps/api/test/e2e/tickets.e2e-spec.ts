import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { isE2EEnvironmentReady, E2E_SKIP_MESSAGE, setupE2ETest, AuthHelper, E2ETestContext } from './setup';

/**
 * Tickets E2E Tests
 *
 * Tests the full ticket management flow including:
 * - Creating tickets
 * - Listing tickets
 * - Filtering tickets
 * - Updating ticket status
 * - Ticket analytics
 */

const shouldRun = isE2EEnvironmentReady();

(shouldRun ? describe : describe.skip)('Tickets (E2E)', () => {
  let ctx: E2ETestContext;
  let authHelper: AuthHelper;
  let accessToken: string;
  let applicationId: string;
  let createdTicketId: string;

  const testUser = {
    email: `e2e-tickets-${Date.now()}@test.com`,
    password: 'SecurePassword123!',
    name: 'E2E Tickets User',
    tenantName: 'E2E Tickets Tenant',
  };

  beforeAll(async () => {
    // Dynamic import to avoid loading AppModule when tests are skipped
    const { AppModule } = await import('../../src/app.module');
    ctx = await setupE2ETest(AppModule);
    authHelper = new AuthHelper(ctx.app);

    // Register and get token
    const authResponse = await authHelper.register(testUser);
    accessToken = authResponse.accessToken;

    // Create an application for tickets
    const appResponse = await request(ctx.app.getHttpServer())
      .post('/applications')
      .set(authHelper.getAuthHeader(accessToken))
      .send({ name: 'Tickets Test App', platform: 'web' });

    applicationId = appResponse.body.id;
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  describe('POST /tickets', () => {
    it('should create a ticket', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/tickets')
        .set(authHelper.getAuthHeader(accessToken))
        .send({
          applicationId,
          title: 'Test Bug Report',
          description: 'Something is not working correctly',
          type: 'bug',
          severity: 'medium',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Bug Report');
      expect(response.body.status).toBe('new');

      createdTicketId = response.body.id;
    });

    it('should create a ticket without type (to be classified by AI)', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/tickets')
        .set(authHelper.getAuthHeader(accessToken))
        .send({
          applicationId,
          title: 'Feature Request',
          description: 'I would like a new feature',
        })
        .expect(201);

      expect(response.body.type).toBeNull();
    });
  });

  describe('GET /tickets', () => {
    it('should list all tickets', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/tickets')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter tickets by application', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/tickets?applicationId=${applicationId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.every((t: any) => t.applicationId === applicationId)).toBe(true);
    });

    it('should filter tickets by status', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/tickets?status=new')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.every((t: any) => t.status === 'new')).toBe(true);
    });

    it('should filter tickets by type', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/tickets?type=bug')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.every((t: any) => t.type === 'bug')).toBe(true);
    });
  });

  describe('GET /tickets/:id', () => {
    it('should get a specific ticket', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/tickets/${createdTicketId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.id).toBe(createdTicketId);
    });
  });

  describe('PATCH /tickets/:id', () => {
    it('should update ticket status', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.status).toBe('in_progress');
    });

    it('should update ticket priority', async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch(`/tickets/${createdTicketId}`)
        .set(authHelper.getAuthHeader(accessToken))
        .send({ priority: 5 })
        .expect(200);

      expect(response.body.priority).toBe(5);
    });
  });

  describe('POST /tickets/:id/resolve', () => {
    it('should resolve a ticket', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/tickets/${createdTicketId}/resolve`)
        .set(authHelper.getAuthHeader(accessToken))
        .send({ resolution: 'Fixed in latest release' })
        .expect(200);

      expect(response.body.status).toBe('resolved');
    });
  });

  describe('GET /tickets/stats', () => {
    it('should return ticket statistics', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/tickets/stats')
        .set(authHelper.getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byType');
    });
  });
});

if (!shouldRun) {
  describe('Tickets (E2E) - SKIPPED', () => {
    it(E2E_SKIP_MESSAGE, () => {
      console.log(E2E_SKIP_MESSAGE);
    });
  });
}

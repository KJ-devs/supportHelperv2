import { PrismaService } from '@/prisma/prisma.service';
import { setupIntegrationTest, testData, IntegrationTestContext } from './setup';

/**
 * Database Integration Tests
 *
 * Tests actual database operations with a real PostgreSQL instance.
 * Requires TEST_DATABASE_URL environment variable.
 */

const isIntegrationTest = !!process.env.TEST_DATABASE_URL;

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(isIntegrationTest)('Database Integration', () => {
  let ctx: IntegrationTestContext;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Tenant Operations', () => {
    it('should create and retrieve a tenant', async () => {
      const tenantData = testData.createTenant();

      const tenant = await ctx.prisma.tenant.create({
        data: tenantData,
      });

      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe(tenantData.name);
      expect(tenant.slug).toBe(tenantData.slug);

      // Retrieve
      const found = await ctx.prisma.tenant.findUnique({
        where: { id: tenant.id },
      });

      expect(found).toBeDefined();
      expect(found?.name).toBe(tenantData.name);

      // Cleanup
      await ctx.prisma.tenant.delete({ where: { id: tenant.id } });
    });

    it('should enforce unique slug constraint', async () => {
      const tenantData = testData.createTenant({ slug: 'unique-slug-test' });

      await ctx.prisma.tenant.create({ data: tenantData });

      await expect(
        ctx.prisma.tenant.create({
          data: { ...tenantData, name: 'Different Name' },
        })
      ).rejects.toThrow();

      // Cleanup
      await ctx.prisma.tenant.delete({ where: { slug: tenantData.slug } });
    });
  });

  describe('User Operations', () => {
    let tenantId: string;

    beforeEach(async () => {
      const tenant = await ctx.prisma.tenant.create({
        data: testData.createTenant(),
      });
      tenantId = tenant.id;
    });

    afterEach(async () => {
      await ctx.prisma.user.deleteMany({ where: { tenantId } });
      await ctx.prisma.tenant.delete({ where: { id: tenantId } });
    });

    it('should create a user with tenant relationship', async () => {
      const userData = testData.createUser(tenantId);

      const user = await ctx.prisma.user.create({
        data: userData,
        include: { tenant: true },
      });

      expect(user.id).toBeDefined();
      expect(user.tenantId).toBe(tenantId);
      expect(user.tenant).toBeDefined();
    });

    it('should enforce unique email per tenant', async () => {
      const email = 'duplicate@test.com';
      const userData = testData.createUser(tenantId, { email });

      await ctx.prisma.user.create({ data: userData });

      await expect(
        ctx.prisma.user.create({
          data: { ...testData.createUser(tenantId), email },
        })
      ).rejects.toThrow();
    });
  });

  describe('Application Operations', () => {
    let tenantId: string;

    beforeEach(async () => {
      const tenant = await ctx.prisma.tenant.create({
        data: testData.createTenant(),
      });
      tenantId = tenant.id;
    });

    afterEach(async () => {
      await ctx.prisma.application.deleteMany({ where: { tenantId } });
      await ctx.prisma.tenant.delete({ where: { id: tenantId } });
    });

    it('should create an application with unique SDK key', async () => {
      const appData = testData.createApplication(tenantId);

      const app = await ctx.prisma.application.create({
        data: appData,
      });

      expect(app.id).toBeDefined();
      expect(app.sdkKey).toBe(appData.sdkKey);
    });

    it('should enforce unique SDK key', async () => {
      const sdkKey = `sk_unique_${Date.now()}`;
      const appData = testData.createApplication(tenantId, { sdkKey });

      await ctx.prisma.application.create({ data: appData });

      await expect(
        ctx.prisma.application.create({
          data: { ...testData.createApplication(tenantId), sdkKey },
        })
      ).rejects.toThrow();
    });
  });

  describe('Ticket Operations', () => {
    let tenantId: string;
    let applicationId: string;

    beforeEach(async () => {
      const tenant = await ctx.prisma.tenant.create({
        data: testData.createTenant(),
      });
      tenantId = tenant.id;

      const app = await ctx.prisma.application.create({
        data: testData.createApplication(tenantId),
      });
      applicationId = app.id;
    });

    afterEach(async () => {
      await ctx.prisma.ticket.deleteMany({ where: { applicationId } });
      await ctx.prisma.application.delete({ where: { id: applicationId } });
      await ctx.prisma.tenant.delete({ where: { id: tenantId } });
    });

    it('should create a ticket with relationships', async () => {
      const ticketData = testData.createTicket(tenantId, applicationId);

      const ticket = await ctx.prisma.ticket.create({
        data: ticketData,
        include: { tenant: true, application: true },
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.tenant).toBeDefined();
      expect(ticket.application).toBeDefined();
    });

    it('should filter tickets by status', async () => {
      await ctx.prisma.ticket.createMany({
        data: [
          testData.createTicket(tenantId, applicationId, { status: 'new' }),
          testData.createTicket(tenantId, applicationId, { status: 'in_progress' }),
          testData.createTicket(tenantId, applicationId, { status: 'resolved' }),
        ],
      });

      const newTickets = await ctx.prisma.ticket.findMany({
        where: { applicationId, status: 'new' },
      });

      expect(newTickets.length).toBe(1);
    });
  });
});

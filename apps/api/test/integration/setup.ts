import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Integration Test Setup
 *
 * These tests require running services:
 * - PostgreSQL (TEST_DATABASE_URL)
 * - Redis (TEST_REDIS_URL)
 * - S3/MinIO (TEST_S3_ENDPOINT)
 *
 * Use test containers or docker-compose for local testing.
 */

export interface IntegrationTestContext {
  module: TestingModule;
  prisma: PrismaService;
  cleanup: () => Promise<void>;
}

export async function setupIntegrationTest(
  imports: any[] = [],
  providers: any[] = []
): Promise<IntegrationTestContext> {
  const module = await Test.createTestingModule({
    imports,
    providers: [PrismaService, ...providers],
  }).compile();

  const prisma = module.get<PrismaService>(PrismaService);

  const cleanup = async () => {
    // Clean up test data in reverse dependency order
    await prisma.$executeRaw`DELETE FROM classification_feedback WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM agent_sessions WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM media_files WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM tickets WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM applications WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM github_connections WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM users WHERE 1=1`;
    await prisma.$executeRaw`DELETE FROM tenants WHERE 1=1`;
    await prisma.$disconnect();
  };

  return { module, prisma, cleanup };
}

export const testData = {
  createTenant: (overrides = {}) => ({
    name: `Test Tenant ${Date.now()}`,
    slug: `test-tenant-${Date.now()}`,
    plan: 'free',
    settings: {},
    ...overrides,
  }),

  createUser: (tenantId: string, overrides = {}) => ({
    tenantId,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'member',
    passwordHash: '$2b$10$test-hash',
    authProvider: 'email',
    ...overrides,
  }),

  createApplication: (tenantId: string, overrides = {}) => ({
    tenantId,
    name: `Test App ${Date.now()}`,
    platform: 'web',
    sdkKey: `sk_test_${Date.now()}`,
    settings: {},
    ...overrides,
  }),

  createTicket: (tenantId: string, applicationId: string, overrides = {}) => ({
    tenantId,
    applicationId,
    status: 'new',
    type: 'bug',
    severity: 'medium',
    priority: 1,
    title: `Test Ticket ${Date.now()}`,
    description: 'Test description',
    keywords: [],
    ...overrides,
  }),
};

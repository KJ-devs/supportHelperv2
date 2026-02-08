import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Migration Tests
 *
 * These tests verify that database migrations work correctly.
 * They require a running PostgreSQL instance (use test containers in CI).
 *
 * Set TEST_DATABASE_URL environment variable to run these tests.
 */

const isIntegrationTest = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!isIntegrationTest)('Database Migrations', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.TEST_DATABASE_URL },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Migration Up', () => {
    it('should apply all migrations successfully', async () => {
      // Run migrations
      execSync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL,
        },
      });

      // Verify tables exist
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `;

      const tableNames = tables.map(t => t.tablename);
      expect(tableNames).toContain('tenants');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('applications');
      expect(tableNames).toContain('tickets');
    });

    it('should create all required columns on tenants table', async () => {
      const columns = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'tenants'
      `;

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('slug');
      expect(columnNames).toContain('plan');
      expect(columnNames).toContain('settings');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should create all required columns on users table', async () => {
      const columns = await prisma.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users'
      `;

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('tenant_id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('role');
      expect(columnNames).toContain('password_hash');
    });

    it('should create unique constraint on tenant slug', async () => {
      const constraints = await prisma.$queryRaw<{ constraint_name: string }[]>`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'tenants' AND constraint_type = 'UNIQUE'
      `;

      const constraintNames = constraints.map(c => c.constraint_name);
      expect(constraintNames.some(name => name.includes('slug'))).toBe(true);
    });

    it('should create foreign key from users to tenants', async () => {
      const fkeys = await prisma.$queryRaw<{ constraint_name: string }[]>`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_type = 'FOREIGN KEY'
      `;

      expect(fkeys.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Down (Reset)', () => {
    it('should reset database successfully', async () => {
      // This test is destructive - only run in isolated test environment
      if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
        console.log('Skipping destructive test - set ALLOW_DESTRUCTIVE_TESTS=true to run');
        return;
      }

      execSync('npx prisma migrate reset --force', {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL,
        },
      });

      // Verify migrations were reapplied
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `;

      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce tenant slug uniqueness', async () => {
      // Create first tenant
      await prisma.$executeRaw`
        INSERT INTO tenants (id, name, slug, created_at, updated_at)
        VALUES (
          uuid_generate_v4(), 
          'Test Tenant 1', 
          'test-unique-slug',
          NOW(),
          NOW()
        )
      `;

      // Try to create duplicate
      await expect(
        prisma.$executeRaw`
          INSERT INTO tenants (id, name, slug, created_at, updated_at)
          VALUES (
            uuid_generate_v4(), 
            'Test Tenant 2', 
            'test-unique-slug',
            NOW(),
            NOW()
          )
        `
      ).rejects.toThrow();

      // Cleanup
      await prisma.$executeRaw`DELETE FROM tenants WHERE slug = 'test-unique-slug'`;
    });

    it('should enforce user-tenant email uniqueness', async () => {
      // Create tenant
      const tenantResult = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO tenants (id, name, slug, created_at, updated_at)
        VALUES (uuid_generate_v4(), 'Test Tenant', 'test-email-unique', NOW(), NOW())
        RETURNING id
      `;
      const tenantId = tenantResult[0].id;

      // Create first user
      await prisma.$executeRaw`
        INSERT INTO users (id, tenant_id, email, role, created_at)
        VALUES (uuid_generate_v4(), ${tenantId}::uuid, 'duplicate@test.com', 'member', NOW())
      `;

      // Try to create duplicate email in same tenant
      await expect(
        prisma.$executeRaw`
          INSERT INTO users (id, tenant_id, email, role, created_at)
          VALUES (uuid_generate_v4(), ${tenantId}::uuid, 'duplicate@test.com', 'member', NOW())
        `
      ).rejects.toThrow();

      // Cleanup
      await prisma.$executeRaw`DELETE FROM users WHERE tenant_id = ${tenantId}::uuid`;
      await prisma.$executeRaw`DELETE FROM tenants WHERE id = ${tenantId}::uuid`;
    });
  });
});

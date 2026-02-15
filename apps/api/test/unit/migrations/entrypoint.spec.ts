/**
 * Docker Entrypoint Script Tests
 *
 * Validates that docker/entrypoint.sh contains the expected commands
 * for database readiness checks, advisory locks, and Prisma migrations.
 */

import * as fs from 'fs';
import * as path from 'path';

const ENTRYPOINT_PATH = path.resolve(
  __dirname,
  '../../../../../docker/entrypoint.sh',
);

describe('Docker Entrypoint Script', () => {
  let scriptContent: string;

  beforeAll(() => {
    scriptContent = fs.readFileSync(ENTRYPOINT_PATH, 'utf-8');
  });

  it('should exist at docker/entrypoint.sh', () => {
    expect(fs.existsSync(ENTRYPOINT_PATH)).toBe(true);
  });

  it('should start with a valid shebang', () => {
    expect(scriptContent).toMatch(/^#!\/bin\/sh/);
  });

  it('should use set -e for fail-fast behavior', () => {
    expect(scriptContent).toContain('set -e');
  });

  describe('Database Readiness Check', () => {
    it('should extract DB host from DATABASE_URL', () => {
      expect(scriptContent).toContain('DB_HOST=');
      expect(scriptContent).toContain('DATABASE_URL');
    });

    it('should have a retry loop for DB connectivity', () => {
      expect(scriptContent).toContain('MAX_RETRIES=');
      expect(scriptContent).toContain('RETRY_INTERVAL=');
      expect(scriptContent).toMatch(/while.*retries.*MAX_RETRIES/s);
    });

    it('should use nc to check PostgreSQL port', () => {
      expect(scriptContent).toMatch(/nc\s+-z/);
    });

    it('should exit with error if DB is not reachable after max retries', () => {
      expect(scriptContent).toMatch(
        /PostgreSQL not reachable after.*Exiting/,
      );
      expect(scriptContent).toContain('exit 1');
    });
  });

  describe('Advisory Lock for Migrations', () => {
    it('should define an advisory lock ID', () => {
      expect(scriptContent).toMatch(/ADVISORY_LOCK_ID=\d+/);
    });

    it('should attempt to acquire advisory lock with pg_try_advisory_lock', () => {
      expect(scriptContent).toContain('pg_try_advisory_lock');
    });

    it('should release advisory lock with pg_advisory_unlock', () => {
      expect(scriptContent).toContain('pg_advisory_unlock');
    });

    it('should use trap to ensure lock release on failure', () => {
      expect(scriptContent).toMatch(/trap\s+release_lock\s+EXIT/);
    });

    it('should define a release_lock function', () => {
      expect(scriptContent).toMatch(/release_lock\s*\(\)/);
    });

    it('should clear trap before exec to avoid releasing after migration success', () => {
      expect(scriptContent).toContain('trap - EXIT');
    });

    it('should handle lock-not-acquired case by waiting', () => {
      expect(scriptContent).toContain(
        'another instance is running migrations',
      );
      expect(scriptContent).toContain('MIGRATION_WAIT_RETRIES');
      expect(scriptContent).toContain('MIGRATION_WAIT_INTERVAL');
    });

    it('should use psql to communicate with PostgreSQL for locking', () => {
      expect(scriptContent).toMatch(/psql\s+"\$DATABASE_URL"/);
    });
  });

  describe('Prisma Migrations', () => {
    it('should check RUN_MIGRATIONS environment variable', () => {
      expect(scriptContent).toContain('RUN_MIGRATIONS');
    });

    it('should run prisma migrate deploy', () => {
      expect(scriptContent).toContain('prisma migrate deploy');
    });

    it('should reference PRISMA_SCHEMA with a default value', () => {
      expect(scriptContent).toMatch(
        /PRISMA_SCHEMA=.*apps\/api\/prisma\/schema\.prisma/,
      );
    });

    it('should include rollback procedure in migration failure output', () => {
      expect(scriptContent).toContain('ROLLBACK PROCEDURE');
      expect(scriptContent).toContain('prisma migrate status');
      expect(scriptContent).toContain('prisma migrate resolve');
    });

    it('should skip migrations when RUN_MIGRATIONS is not true', () => {
      expect(scriptContent).toContain(
        'Skipping migrations (RUN_MIGRATIONS != true)',
      );
    });
  });

  describe('Application Start', () => {
    it('should use exec to replace shell process with the application', () => {
      expect(scriptContent).toMatch(/exec\s+"\$@"/);
    });

    it('should log the application command being started', () => {
      expect(scriptContent).toContain('Starting application');
    });
  });
});

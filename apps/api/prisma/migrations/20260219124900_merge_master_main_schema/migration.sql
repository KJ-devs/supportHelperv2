-- DropIndex
DROP INDEX IF EXISTS "idx_codebase_embeddings_vector";

-- AlterTable
ALTER TABLE "sso_config" ALTER COLUMN "config" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "archived_dead_letter_jobs" ADD CONSTRAINT "archived_dead_letter_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

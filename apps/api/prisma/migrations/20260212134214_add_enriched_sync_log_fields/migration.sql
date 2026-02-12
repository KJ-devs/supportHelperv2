-- AlterTable
ALTER TABLE "integration_sync_logs" ADD COLUMN     "action" VARCHAR(20),
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "external_url" TEXT,
ADD COLUMN     "provider" VARCHAR(50),
ADD COLUMN     "triggered_by" VARCHAR(20);

-- CreateIndex
CREATE INDEX "integration_sync_logs_action_idx" ON "integration_sync_logs"("action");

-- CreateTable
CREATE TABLE "archived_dead_letter_jobs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,
    "queue_name" VARCHAR(100) NOT NULL,
    "job_id" VARCHAR(255) NOT NULL,
    "job_name" VARCHAR(255),
    "job_data" JSONB NOT NULL,
    "failed_reason" TEXT,
    "stack_trace" TEXT[],
    "attempts_made" INTEGER NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" UUID,
    "application_id" UUID,

    CONSTRAINT "archived_dead_letter_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "archived_dead_letter_jobs_tenant_id_archived_at_idx" ON "archived_dead_letter_jobs"("tenant_id", "archived_at" DESC);

-- CreateIndex
CREATE INDEX "archived_dead_letter_jobs_queue_name_archived_at_idx" ON "archived_dead_letter_jobs"("queue_name", "archived_at" DESC);

-- CreateIndex
CREATE INDEX "archived_dead_letter_jobs_ticket_id_idx" ON "archived_dead_letter_jobs"("ticket_id");

-- CreateIndex
CREATE INDEX "archived_dead_letter_jobs_archived_at_idx" ON "archived_dead_letter_jobs"("archived_at");

-- AlterTable: Add review tracking fields to agent_tasks (US-3.4)
ALTER TABLE "agent_tasks" ADD COLUMN "review_requested_at" TIMESTAMP(3);
ALTER TABLE "agent_tasks" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "agent_tasks" ADD COLUMN "reviewed_by" VARCHAR(255);
ALTER TABLE "agent_tasks" ADD COLUMN "rejection_reason" TEXT;

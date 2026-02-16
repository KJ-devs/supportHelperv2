-- AlterTable
ALTER TABLE "agent_tasks" ADD COLUMN     "branch_name" VARCHAR(255),
ADD COLUMN     "pr_number" INTEGER,
ADD COLUMN     "pr_url" TEXT;

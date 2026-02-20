/*
  Warnings:

  - A unique constraint covering the columns `[repo_config_id]` on the table `codebase_index_status` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[application_id,owner,repo]` on the table `project_github_configs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "project_github_configs_application_id_key";

-- AlterTable
ALTER TABLE "agent_tasks" ADD COLUMN     "repo_config_id" UUID,
ADD COLUMN     "task_group_id" UUID;

-- AlterTable
ALTER TABLE "codebase_embeddings" ADD COLUMN     "repo_config_id" UUID;

-- AlterTable
ALTER TABLE "codebase_index_status" ADD COLUMN     "repo_config_id" UUID;

-- AlterTable
ALTER TABLE "project_github_configs" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" VARCHAR(50) NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN     "action_state" VARCHAR(20),
ADD COLUMN     "parent_id" UUID;

-- CreateIndex
CREATE INDEX "agent_tasks_task_group_id_idx" ON "agent_tasks"("task_group_id");

-- CreateIndex
CREATE INDEX "codebase_embeddings_repo_config_id_idx" ON "codebase_embeddings"("repo_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "codebase_index_status_repo_config_id_key" ON "codebase_index_status"("repo_config_id");

-- CreateIndex
CREATE INDEX "project_github_configs_application_id_idx" ON "project_github_configs"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_github_configs_application_id_owner_repo_key" ON "project_github_configs"("application_id", "owner", "repo");

-- CreateIndex
CREATE INDEX "ticket_messages_parent_id_idx" ON "ticket_messages"("parent_id");

-- AddForeignKey
ALTER TABLE "codebase_embeddings" ADD CONSTRAINT "codebase_embeddings_repo_config_id_fkey" FOREIGN KEY ("repo_config_id") REFERENCES "project_github_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codebase_index_status" ADD CONSTRAINT "codebase_index_status_repo_config_id_fkey" FOREIGN KEY ("repo_config_id") REFERENCES "project_github_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ticket_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

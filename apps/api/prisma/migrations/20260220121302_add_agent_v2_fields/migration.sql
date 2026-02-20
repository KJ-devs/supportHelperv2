-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN     "anthropic_messages" JSONB,
ADD COLUMN     "tool_call_log" JSONB;

-- AlterTable
ALTER TABLE "agent_tasks" ADD COLUMN     "diagnosis_snapshot" JSONB;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "diagnosis" JSONB,
ADD COLUMN     "diagnosis_updated_at" TIMESTAMP(3);

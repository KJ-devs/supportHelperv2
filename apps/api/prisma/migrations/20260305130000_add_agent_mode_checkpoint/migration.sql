-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN "agent_mode" VARCHAR(20) NOT NULL DEFAULT 'autonomous';
ALTER TABLE "agent_sessions" ADD COLUMN "checkpoint_state" VARCHAR(50) NOT NULL DEFAULT 'none';

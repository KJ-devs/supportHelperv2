ALTER TABLE "ai_prompt_configs" ADD COLUMN "triage_temperature" DOUBLE PRECISION DEFAULT 0.1;
ALTER TABLE "ai_prompt_configs" ADD COLUMN "n1_temperature" DOUBLE PRECISION DEFAULT 0.1;
ALTER TABLE "ai_prompt_configs" ADD COLUMN "analysis_temperature" DOUBLE PRECISION DEFAULT 0.3;
ALTER TABLE "ai_prompt_configs" ADD COLUMN "max_iterations_n2" INTEGER DEFAULT 15;
ALTER TABLE "ai_prompt_configs" ADD COLUMN "timeout_n2" INTEGER DEFAULT 120;

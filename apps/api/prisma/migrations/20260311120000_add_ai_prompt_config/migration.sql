-- CreateTable
CREATE TABLE "ai_prompt_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "product_description" TEXT,
    "global_instructions" TEXT,
    "triage_instructions" TEXT,
    "analysis_instructions" TEXT,
    "response_language" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_configs_tenant_id_key" ON "ai_prompt_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "ai_prompt_configs" ADD CONSTRAINT "ai_prompt_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

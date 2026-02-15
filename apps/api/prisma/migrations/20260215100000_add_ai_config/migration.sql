-- CreateTable
CREATE TABLE "ai_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'anthropic',
    "encrypted_api_key" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_tenant_id_key" ON "ai_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

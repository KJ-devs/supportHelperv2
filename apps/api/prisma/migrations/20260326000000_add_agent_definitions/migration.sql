-- CreateTable
CREATE TABLE "agent_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "toolset" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trigger_rules" JSONB,
    "model" VARCHAR(100),
    "temperature" DOUBLE PRECISION,
    "max_iterations" INTEGER DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_definitions_tenant_id_idx" ON "agent_definitions"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_definitions_tenant_id_is_active_idx" ON "agent_definitions"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

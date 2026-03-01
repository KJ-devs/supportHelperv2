-- CreateTable
CREATE TABLE "tenant_quotas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'free',
    "monthly_quota" INTEGER NOT NULL DEFAULT 10,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "quota_reset_at" TIMESTAMP(3) NOT NULL,
    "is_byok" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quotas_tenant_id_key" ON "tenant_quotas"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_quotas" ADD CONSTRAINT "tenant_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

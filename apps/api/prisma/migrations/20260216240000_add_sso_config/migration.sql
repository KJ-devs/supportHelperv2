-- CreateTable
CREATE TABLE "sso_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "provider_type" VARCHAR(20) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL,
    "config_iv" VARCHAR(32) NOT NULL,
    "role_mapping" JSONB NOT NULL DEFAULT '{}',
    "auto_provision" BOOLEAN NOT NULL DEFAULT true,
    "disable_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_config_tenant_id_key" ON "sso_config"("tenant_id");

-- AddForeignKey
ALTER TABLE "sso_config" ADD CONSTRAINT "sso_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

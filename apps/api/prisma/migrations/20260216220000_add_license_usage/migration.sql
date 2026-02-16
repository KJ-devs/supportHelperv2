-- CreateTable
CREATE TABLE "license_usage" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "metric" VARCHAR(50) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "license_usage_tenant_id_idx" ON "license_usage"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "license_usage_tenant_id_month_metric_key" ON "license_usage"("tenant_id", "month", "metric");

-- AddForeignKey
ALTER TABLE "license_usage" ADD CONSTRAINT "license_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

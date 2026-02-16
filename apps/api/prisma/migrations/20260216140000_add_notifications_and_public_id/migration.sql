-- AlterTable: Add public_id to tickets
ALTER TABLE "tickets" ADD COLUMN "public_id" VARCHAR(20);

-- CreateIndex: unique index on public_id
CREATE UNIQUE INDEX "tickets_public_id_key" ON "tickets"("public_id");

-- CreateTable: notification_preferences
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_logs
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ticket_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: notification_preferences indexes
CREATE INDEX "notification_preferences_application_id_idx" ON "notification_preferences"("application_id");
CREATE INDEX "notification_preferences_tenant_id_idx" ON "notification_preferences"("tenant_id");

-- CreateIndex: notification_logs indexes
CREATE INDEX "notification_logs_ticket_id_idx" ON "notification_logs"("ticket_id");
CREATE INDEX "notification_logs_tenant_id_idx" ON "notification_logs"("tenant_id");
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- AddForeignKey: notification_preferences -> applications
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notification_preferences -> tenants
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notification_logs -> tickets
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notification_logs -> tenants
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

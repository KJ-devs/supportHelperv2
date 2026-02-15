-- CreateTable
CREATE TABLE "github_installations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_github_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "application_id" UUID NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_github_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_webhook_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "installation_id" BIGINT,
    "event_type" TEXT NOT NULL,
    "action" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_installations_installation_id_key" ON "github_installations"("installation_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_github_configs_application_id_key" ON "project_github_configs"("application_id");

-- CreateIndex
CREATE INDEX "github_webhook_events_event_type_idx" ON "github_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "github_webhook_events_installation_id_idx" ON "github_webhook_events"("installation_id");

-- CreateIndex
CREATE INDEX "github_webhook_events_processed_idx" ON "github_webhook_events"("processed");

-- CreateIndex
CREATE INDEX "github_webhook_events_created_at_idx" ON "github_webhook_events"("created_at");

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_github_configs" ADD CONSTRAINT "project_github_configs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_github_configs" ADD CONSTRAINT "project_github_configs_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "github_installations"("installation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

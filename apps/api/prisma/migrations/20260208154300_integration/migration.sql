-- CreateIndex
CREATE INDEX "media_processing_status_idx" ON "media"("processing_status");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_status_idx" ON "tickets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_created_at_idx" ON "tickets"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tickets_tenant_id_assigned_to_idx" ON "tickets"("tenant_id", "assigned_to");

-- CreateIndex
CREATE INDEX "tickets_application_id_created_at_idx" ON "tickets"("application_id", "created_at" DESC);

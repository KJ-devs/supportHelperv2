-- CreateIndex
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX "github_connections_tenant_id_idx" ON "github_connections"("tenant_id");

-- CreateIndex
CREATE INDEX "classification_feedback_ticket_id_idx" ON "classification_feedback"("ticket_id");

-- CreateIndex
CREATE INDEX "tickets_reporter_id_idx" ON "tickets"("reporter_id");

-- CreateIndex
CREATE INDEX "ticket_messages_type_idx" ON "ticket_messages"("type");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

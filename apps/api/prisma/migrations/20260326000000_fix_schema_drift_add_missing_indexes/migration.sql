-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "github_connections_tenant_id_idx" ON "github_connections"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classification_feedback_ticket_id_idx" ON "classification_feedback"("ticket_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_reporter_id_idx" ON "tickets"("reporter_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_messages_type_idx" ON "ticket_messages"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

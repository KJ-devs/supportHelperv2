-- Phase A: Recreate HNSW indexes on vector columns
-- These were dropped in migration 20260219124900_merge_master_main_schema

-- HNSW index on codebase_embeddings.embedding (vector 1536)
CREATE INDEX IF NOT EXISTS "idx_codebase_embeddings_vector"
  ON "codebase_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- NOTE: tickets.embedding is vector(3072) which exceeds pgvector's 2000 dimension
-- limit for both HNSW and IVFFlat indexes. No vector index can be created.
-- Consider reducing embedding dimensions or upgrading pgvector when support is added.

-- Phase B: Add missing B-tree indexes for common query patterns

-- classification_feedback(ticketId) — for feedback lookups per ticket
CREATE INDEX IF NOT EXISTS "classification_feedback_ticket_id_idx"
  ON "classification_feedback" ("ticket_id");

-- agent_sessions(status) — for filtering active/completed/escalated sessions
CREATE INDEX IF NOT EXISTS "agent_sessions_status_idx"
  ON "agent_sessions" ("status");

-- github_connections(tenantId) — for tenant-scoped GitHub connection lookups
CREATE INDEX IF NOT EXISTS "github_connections_tenant_id_idx"
  ON "github_connections" ("tenant_id");

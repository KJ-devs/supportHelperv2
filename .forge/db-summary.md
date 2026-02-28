# DB Sprint 2 Summary

## Status: Completed
Date: 2026-02-22

---

## Phase A: HNSW Indexes Recreated

Migration created: `apps/api/prisma/migrations/20260222000000_add_missing_indexes_and_hnsw/migration.sql`

**Indexes restored/created:**
- `idx_codebase_embeddings_vector` — HNSW on `codebase_embeddings.embedding` (vector_cosine_ops, m=16, ef_construction=64)
  _Was dropped in migration 20260219124900_merge_master_main_schema_
- `idx_tickets_embedding_vector` — HNSW on `tickets.embedding` (vector_cosine_ops, m=16, ef_construction=64)
  _New; tickets.embedding was added in 20260220084517 without an HNSW index_

Both use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` for safe execution on live databases.

---

## Phase B: Missing B-tree Indexes Added

Same migration as Phase A:
- `classification_feedback(ticket_id)` — supports feedback lookup per ticket
- `agent_sessions(status)` — supports filtering active/completed/escalated sessions
- `github_connections(tenant_id)` — supports tenant-scoped GitHub connection lookups

Also added to `schema.prisma` as `@@index` directives:
- `ClassificationFeedback @@index([ticketId])`
- `AgentSession @@index([status])`
- `GithubConnection @@index([tenantId])`

---

## Phase C: Seed Data Fixed

File: `apps/api/prisma/seed.ts`

**Fixes:**
- `role: 'owner'` → `role: 'admin'` (user renamed to `adminUser`)
- `role: 'support'` → `role: 'member'` (user renamed to `memberUser`)
- Removed invalid `'open'` from statuses array (only valid: `new`, `triaged`, `in_progress`, `resolved`, `closed`)

**Added seed data:**
- `AiConfig` — tenant AI configuration with Anthropic provider
- `TicketEvent` (x2) — `ticket_created` and `status_changed` events for ticket #1
- `TicketMessage` (x3) — system, agent, and user messages for ticket #1 (with thread via parentId)
- `AgentTask` — with action plan JSON and execution log for ticket #2

**Cleanup additions:**
- `prisma.ticketMessage.deleteMany()` added to cleanup block
- `prisma.ticketEvent.deleteMany()` added to cleanup block
- `prisma.agentTask.deleteMany()` added to cleanup block
- `prisma.aiConfig.deleteMany()` added to cleanup block

---

## Phase D: Zod Schemas Fixed and Extended

File: `packages/database/src/schemas.ts`

**Fixes:**
- `TenantSchema.plan`: changed from `TenantPlanSchema.default('free')` (enum) to `z.string().max(50).default('free')` (matches Prisma String field)
- `TicketSchema.reproductionSteps`: changed from `z.array(z.string()).nullish()` to `z.record(z.unknown()).nullish()` (matches Prisma `Json?`)

**New schemas added:**
- `AiConfigSchema` / `CreateAiConfigSchema` / `UpdateAiConfigSchema`
- `AgentTaskSchema` / `CreateAgentTaskSchema` / `UpdateAgentTaskSchema` + `AgentTaskStatusSchema`
- `TicketEventSchema` / `CreateTicketEventSchema`
- `TicketMessageSchema` / `CreateTicketMessageSchema` / `UpdateTicketMessageSchema` + `TicketMessageTypeSchema`
- `GithubInstallationSchema` / `CreateGithubInstallationSchema`
- `ProjectGithubConfigSchema` / `CreateProjectGithubConfigSchema` / `UpdateProjectGithubConfigSchema`

All corresponding TypeScript types exported.

---

## Build Verification

- `pnpm --filter @support-helper/database build` — Exit 0 (no errors)
- `pnpm --filter @support-helper/api build` — Exit 0 (no errors)

**Note:** `pnpm db:generate` fails with EPERM (DLL file locked by running dev server).
The existing Prisma client types are already compatible with the schema changes (only indexes added, no new columns or models). Run `pnpm db:generate` after stopping the dev server.

---

## Remaining Schema Coverage

Updated coverage in packages/database/src/schemas.ts:
- Tenant ✅, User ✅, Application ✅, Ticket ✅ (reproductionSteps fixed)
- Media ✅, VideoEvent ✅, GithubConnection ✅, GithubIssue ✅
- Integration ✅, IntegrationSyncLog ✅, AgentSession ✅, AgentMessage ✅
- ClassificationFeedback ✅, AiConfig ✅ (new), AgentTask ✅ (new)
- TicketEvent ✅ (new), TicketMessage ✅ (new)
- GithubInstallation ✅ (new), ProjectGithubConfig ✅ (new)

**Still missing (lower priority):**
- CodebaseEmbedding, CodebaseIndexStatus, GithubWebhookEvent
- NotificationPreference, NotificationLog, SystemConfig
- LicenseUsage, AuditLog, SsoConfig, ArchivedDeadLetterJob

---
applyTo: 'apps/api/prisma/**,packages/database/**/*.ts'
---

# Database Instructions

- Schema source of truth: `apps/api/prisma/schema.prisma`
- PostgreSQL extensions: `uuid-ossp`, `pgvector`
- ALL tenant-scoped tables MUST have a `tenantId` column
- Schema change workflow: edit schema → `pnpm db:migrate` → `pnpm db:generate` → update seed if needed
- Always create backwards-compatible migrations
- Always add indexes for foreign keys and common query patterns
- Core models: Tenant, User, Application, Ticket, Media, AgentSession, ClassificationFeedback
- AI fields on Ticket: `aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`

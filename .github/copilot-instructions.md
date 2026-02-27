# Support Helper Platform — Copilot Instructions

AI-powered technical support system. Monorepo TypeScript: NestJS backend, Next.js dashboard, web SDK.

## Build & Validate

Always run these commands to validate changes:

```bash
pnpm install                              # Install all dependencies (always run first)
pnpm build                                # Build all packages — catches TypeScript errors
pnpm test                                 # Run all tests
pnpm lint                                 # Lint all packages
pnpm --filter @support-helper/api build   # Build API only
pnpm --filter @support-helper/dashboard build  # Build dashboard only
pnpm --filter @support-helper/sdk-web build    # Build SDK only
```

Database commands (require Docker running):

```bash
pnpm db:generate    # Generate Prisma client (run after schema changes)
pnpm db:migrate     # Create and apply migrations
pnpm db:seed        # Seed test data
```

Dev servers: `pnpm dev` → API on :3001, Dashboard on :3000

## Monorepo Layout

| Path                            | Tech                  | Purpose                               |
| ------------------------------- | --------------------- | ------------------------------------- |
| `apps/api/src/`                 | NestJS, Prisma        | REST API, auth, guards, DTOs          |
| `apps/api/prisma/schema.prisma` | Prisma                | Database schema (source of truth)     |
| `apps/dashboard/app/`           | Next.js 14 App Router | Dashboard pages and layouts           |
| `apps/dashboard/components/`    | React, Tailwind       | UI components                         |
| `apps/worker/src/`              | NestJS                | Video processing, AI pipeline         |
| `packages/sdk-web/src/`         | TypeScript, Vite      | Web SDK `<support-helper>` component  |
| `packages/shared/src/`          | TypeScript            | Shared types                          |
| `packages/database/src/`        | TypeScript            | DB utilities                          |
| `docker-compose.yml`            | Docker                | PostgreSQL, Redis, MinIO, MeiliSearch |

## Critical Architecture Rules

1. **Multi-tenant**: ALL Prisma queries MUST filter by `tenantId`. Never skip this.
2. **Auth**: Dashboard uses JWT (`JwtAuthGuard`), SDK uses `x-sdk-key` header (`SdkKeyGuard`)
3. **TypeScript strict mode** everywhere — no `any` types
4. **DTOs**: Use `class-validator` decorators for input validation
5. **Errors**: Throw NestJS exceptions (`BadRequestException`, `NotFoundException`)
6. **Uploads**: Pre-signed URLs via MinIO/S3 — never stream through the API
7. **Next.js**: App Router only (NOT Pages Router), `'use client'` only when needed

## Database Schema (key models)

Tenant → User, Application, Ticket, Media, AgentSession, ClassificationFeedback

- Ticket AI fields: `aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`
- Media status: `pending` → `processing` → `completed` → `failed`
- PostgreSQL extensions: `uuid-ossp`, `pgvector`

## Infrastructure (Docker Compose)

PostgreSQL :5432 | Redis :6379 | MinIO :9000 (console :9001, minioadmin/minioadmin) | MeiliSearch

## Custom Agents

Select from the agents dropdown in Copilot Chat: `forge` (orchestrator), `backend-dev`, `frontend-dev`, `sdk-dev`, `dba`, `qa-engineer`, `devops`, `ai-engineer`, `security-auditor`, `doc-writer`. Use `/forge` prompt for full orchestration.

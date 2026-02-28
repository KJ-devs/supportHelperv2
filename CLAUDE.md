# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Support Helper Platform** - an AI-powered technical support system that enables users to report bugs with video capture and automatic analysis. Monorepo built with TypeScript, featuring a NestJS backend API, two Next.js frontends, a background worker, and a web SDK for client integration.

## Development Commands

### Initial Setup
```bash
pnpm install                    # Install all dependencies
cp .env.example .env.local      # Configure environment
pnpm docker:up                  # Start PostgreSQL, Redis, MinIO, MeiliSearch, MailHog
pnpm db:migrate                 # Run database migrations
pnpm db:seed                    # Seed test data
```

### Development
```bash
pnpm dev                        # Start all services (API :3001, Dashboard :3000, Web :3002)
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm test                       # Run tests
pnpm format                     # Format code with Prettier
```

### Database
```bash
pnpm db:migrate                 # Create and apply migrations (Prisma)
pnpm db:generate                # Generate Prisma client for API + Worker
pnpm db:studio                  # Open Prisma Studio GUI
pnpm db:seed                    # Seed database with test data
```

### Package-Specific Commands
```bash
pnpm --filter @support-helper/api [command]
pnpm --filter @support-helper/dashboard [command]
pnpm --filter @support-helper/sdk-web [command]
pnpm --filter @support-helper/worker [command]

# SDK CDN build (required for widget to render)
pnpm --filter @support-helper/sdk-web build:cdn
```

### Testing
```bash
pnpm test                       # Run all tests
pnpm --filter @support-helper/api test              # Jest
pnpm --filter @support-helper/api test:e2e          # Jest E2E
pnpm --filter @support-helper/dashboard test        # Vitest
```

**Test frameworks by package:**
- API + Worker: **Jest** (`*.spec.ts`)
- Dashboard: **Vitest** (`*.test.ts`)

## Architecture

### Monorepo Structure
- **apps/api/** - NestJS backend with Prisma ORM (`@support-helper/api`)
- **apps/dashboard/** - Next.js 14 internal dashboard, App Router (`@support-helper/dashboard`)
- **apps/worker/** - BullMQ job processor: video analysis, GitHub sync, search indexing (`@support-helper/worker`)
- **packages/sdk-web/** - Web SDK for client integration (`@support-helper/sdk-web`)
- **packages/shared/** - Shared TypeScript types and utilities
- **packages/database/** - Database-related utilities

### Backend (NestJS) - apps/api/src/

**Root-level modules (`src/`):**
- **auth/** - JWT authentication, login/register endpoints
- **users/** - User management
- **tenants/** - Multi-tenant isolation
- **applications/** - Application (SDK key) management
- **ai/** - OpenAI integration for video analysis
- **health/** - Health check endpoint
- **common/** - Shared decorators, filters, pipes, interceptors
- **config/** - Configuration modules
- **monitoring/** - Sentry, logging, PostHog integration
- **prisma/** - PrismaService provider

**Nested modules (`src/modules/`):**
- **tickets/** - Ticket CRUD, includes SDK endpoint at `/api/sdk/tickets`
- **media/** - S3/MinIO file uploads with pre-signed URLs
- **agent/** - AI agent conversation management
- **analytics/** - Usage analytics
- **feedback/** - Classification feedback
- **github/** - GitHub OAuth + issue sync
- **integrations/** - Third-party integrations (Jira, HubSpot, Slack, Notion)
- **auth/** - Additional auth strategies and middleware (guards, decorators)

**Key Patterns:**
- NestJS modules with dependency injection
- All services scoped to tenant (multi-tenant via `tenantId`)
- Authentication: JWT for dashboard users, SDK key (`x-sdk-key` header) for SDK clients
- Guards: `JwtAuthGuard` for dashboard, `SdkKeyGuard` for SDK endpoints
- WebSocket: Socket.io gateway for real-time updates (dashboard ↔ API)
- Swagger docs auto-generated at `/api/docs`

### Database Schema (Prisma)

Schema at `apps/api/prisma/schema.prisma`. Worker shares the same schema via `../api/prisma/schema.prisma`.

**Core Models:**
- **Tenant** - Top-level isolation boundary
- **User** - Dashboard users (linked to tenant)
- **Application** - Each app gets an SDK key
- **Ticket** - Bug reports with AI analysis fields (`aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`)
- **Media** - Video/screenshot storage (S3 keys), processing status: `pending` → `processing` → `completed` → `failed`
- **VideoEvent** - Timestamped events extracted from video
- **GithubConnection** - GitHub OAuth tokens per tenant
- **GithubIssue** - Links tickets to GitHub issues
- **Integration** - Third-party integration configs (encrypted)
- **IntegrationSyncLog** - Integration sync history
- **AgentSession** - AI agent conversation state
- **AgentMessage** - AI agent conversation messages
- **ClassificationFeedback** - Human corrections for ML training

**PostgreSQL extensions:** `uuid-ossp`, `pgvector`

### Frontend - apps/dashboard/

- Next.js **14** with App Router
- TanStack Query for server state, Zustand for local state
- TailwindCSS, Axios for API calls
- `next-auth` for session management
- `socket.io-client` for real-time updates
- Sentry + PostHog for monitoring/analytics

### SDK (packages/sdk-web/)

- Exports `SupportHelper` class
- Web Component `<support-helper>` with Shadow DOM
- State machine: idle → open → recording → preview → editing → submitting → success/error
- Captures video using `MediaRecorder` API
- Collects user context (OS, browser, viewport)
- Posts to `/api/sdk/tickets/report` (multipart FormData) with `x-sdk-key` header
- Handles offline queuing with IndexedDB
- **CDN build** outputs to `dist/cdn/` as IIFE bundle

### Worker (apps/worker/)

- NestJS-based BullMQ job processor
- Video analysis pipeline: FFmpeg keyframes → Tesseract OCR → GPT-4 Vision → ticket update
- GitHub issue sync
- MeiliSearch indexing
- Email notifications via Resend

## Development Guidelines

### Adding New Features

**NestJS Modules:**
```bash
cd apps/api
nest generate module feature-name
nest generate service feature-name
nest generate controller feature-name
```

**Database Changes:**
1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm db:migrate` to create migration
3. Run `pnpm db:generate` to update Prisma client (generates for both API and Worker)
4. Update seed file if needed: `apps/api/prisma/seed.ts`

### Multi-Tenant Considerations

All data access must be tenant-scoped:
- API routes check user's `tenantId` from JWT
- SDK endpoints lookup tenant via SDK key
- Database queries always filter by `tenantId`

### Authentication Flow

**Dashboard Users:** POST `/api/auth/login` → JWT → `Authorization: Bearer <token>` → `@UseGuards(JwtAuthGuard)`

**SDK Clients:** SDK key from Application settings → `x-sdk-key` header → `@UseGuards(SdkKeyGuard)`

### File Upload Pattern

1. Client requests pre-signed URL: `POST /api/media/upload-url`
2. API returns S3 pre-signed URL + media record ID
3. Client uploads directly to S3/MinIO
4. Client confirms upload: `POST /api/media/:id/confirm`
5. Backend queues video for AI analysis

### AI Analysis Pipeline

1. Video uploaded to S3
2. Worker extracts keyframes with FFmpeg
3. OCR on frames (Tesseract)
4. Send frames to GPT-4 Vision API
5. Generate summary, classify severity/type
6. Update ticket with AI analysis
7. Status: `pending` → `analyzing` → `analyzed`

## Code Style

- TypeScript strict mode enabled
- `async/await` over promises
- NestJS decorators: `@Injectable()`, `@Controller()`, `@Get()`, etc.
- DTOs: `class-validator` decorators (`@IsString()`, `@IsOptional()`)
- Prisma via `PrismaService` injected through constructor
- Error handling: NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.)

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets (generate with `openssl rand -hex 32`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | MinIO/S3 config |
| `MEILISEARCH_HOST`, `MEILISEARCH_MASTER_KEY` | Full-text search |
| `INTEGRATION_ENCRYPTION_KEY` | Encrypts third-party integration credentials |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `SENTRY_DSN` | Error tracking |
| `POSTHOG_API_KEY` | Product analytics |
| `BETTERSTACK_SOURCE_TOKEN` | Log aggregation |
| `API_PORT` | API port (default 3001) |
| `DASHBOARD_URL` | CORS origin for dashboard |

## User Story Workflow (MANDATORY)

When working on User Stories (US) from GitHub issues, follow this cycle strictly:

### 1. Before starting a US
- Read the summary file `.claude/us-summaries.md` to get context from previously completed US
- Read the GitHub issue to understand acceptance criteria
- Announce which US you are starting

### 2. While working on a US
- Focus exclusively on that US — do not mix changes from other US
- Check each acceptance criterion as you complete it

### 3. After completing a US
- Run `pnpm build` to verify no regressions
- Update the GitHub issue checkboxes (`- [x]`)
- Append a summary to `.claude/us-summaries.md` with:
  - US number and title
  - What was done (files created/modified)
  - Key decisions made
  - Any remaining issues or partial items
- **Commit and push** all changes
- **Clear context** (`/clear`) — start fresh for the next US
- The next conversation picks up by reading `.claude/us-summaries.md`

### 4. Summary file format
```markdown
## [US-XXX-##] Title — DONE ✅
- **Files**: list of created/modified files
- **Changes**: what was implemented
- **Decisions**: any architectural choices made
- **Remaining**: anything left incomplete (with reason)
- **Date**: completion date
```

## Pre-Commit Checklist (MANDATORY)

Before pushing to `main`, you **MUST**:
1. Run `pnpm build` and ensure **all packages build successfully** (0 errors)
2. Fix any build or runtime errors **before** committing

**Git workflow:**
- **Push directly to `main`** — no feature branches, no PRs
- Commit and push all changes directly on the `main` branch
- Remote name: `supportHelperv2`

## Common Pitfalls

1. **SDK CDN build** - Must be built separately: `pnpm --filter @support-helper/sdk-web build:cdn`. Verify `dist/cdn/sdk.iife.js` exists after build. See `packages/sdk-web/CDN_SETUP.md` for details.
2. **Prisma Client not generated** - Run `pnpm db:generate` after schema changes (generates for both API and Worker)
3. **Worker Prisma schema path** - Worker references `../api/prisma/schema.prisma`, not its own copy
4. **Port conflicts** - API=3001, Dashboard=3000, Web=3002, PostgreSQL=5432, Redis=6379, MinIO=9000/9001, MeiliSearch=7700, MailHog=8025(UI)/1025(SMTP)
5. **CORS issues** - Ensure `DASHBOARD_URL` in `.env.local` matches frontend URL
6. **Multi-tenant bugs** - Always filter by `tenantId` in queries
7. **SDK key vs JWT** - SDK endpoints use `x-sdk-key` header, dashboard uses JWT Bearer token
8. **Test framework mismatch** - API/Worker use Jest, Dashboard/Web use Vitest. Don't mix config.
9. **Turbo cache** - Run `pnpm clean` if builds behave unexpectedly
10. **Integration encryption** - `INTEGRATION_ENCRYPTION_KEY` must be set for Jira/HubSpot/Slack integrations to work

## Key Files Reference

- `apps/api/src/main.ts` - API entry point, Swagger setup, CORS config
- `apps/api/src/app.module.ts` - Root module, imports all feature modules
- `apps/api/prisma/schema.prisma` - Database schema (shared with Worker)
- `apps/api/prisma/seed.ts` - Test data seeding
- `apps/dashboard/app/layout.tsx` - Dashboard root layout
- `packages/sdk-web/src/` - SDK source with Web Component
- `turbo.json` - Turborepo pipeline configuration
- `pnpm-workspace.yaml` - Monorepo workspace definition
- `docker-compose.yml` - Infrastructure: PostgreSQL, Redis, MinIO, MeiliSearch, MailHog
- `apps/worker/src/main.ts` - Worker entry point

## Resources

- API Documentation: http://localhost:3001/api/docs (Swagger UI)
- Database GUI: `pnpm db:studio`
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- MeiliSearch: http://localhost:7700
- MailHog UI: http://localhost:8025

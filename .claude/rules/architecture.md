---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
---

# Architecture

## Monorepo Structure

- `apps/api/` — NestJS backend, Prisma ORM (`@support-helper/api`)
- `apps/dashboard/` — Next.js 14, App Router (`@support-helper/dashboard`)
- `apps/worker/` — BullMQ: video analysis, GitHub sync, search indexing (`@support-helper/worker`)
- `packages/sdk-web/` — Web SDK, Web Component `<support-helper>` (`@support-helper/sdk-web`)
- `packages/shared/` — Shared TypeScript types
- `packages/database/` — Database utilities

## Key Patterns

- Multi-tenant: everything scoped by `tenantId`
- Auth: JWT (`JwtAuthGuard`) for dashboard, SDK key `x-sdk-key` header (`SdkKeyGuard`) for SDK
- Uploads: pre-signed URLs via MinIO/S3
- WebSocket: Socket.io gateway for real-time updates
- Swagger: auto-generated at `/api/docs`

## Backend Modules (apps/api/src/)

Root: auth, users, tenants, applications, ai, health, common, config, monitoring, prisma
Nested (src/modules/): tickets, media, agent, analytics, feedback, github, integrations, auth

## Database (Prisma)

Schema: `apps/api/prisma/schema.prisma` (shared with Worker via `../api/prisma/schema.prisma`)
Extensions: `uuid-ossp`, `pgvector`
Core models: Tenant, User, Application, Ticket, Media, VideoEvent, GithubConnection, GithubIssue, Integration, IntegrationSyncLog, AgentSession, AgentMessage, ClassificationFeedback

## Frontend (apps/dashboard/)

Next.js 14 App Router, TanStack Query, Zustand, TailwindCSS, Axios, next-auth, socket.io-client, Sentry + PostHog

## SDK (packages/sdk-web/)

SupportHelper class, Shadow DOM Web Component, state machine: idle > open > recording > preview > editing > submitting > success/error, MediaRecorder API, IndexedDB offline queue, CDN build: `dist/cdn/sdk.iife.js`

## Worker (apps/worker/)

NestJS BullMQ, pipeline: FFmpeg keyframes > Tesseract OCR > GPT-4 Vision > ticket update, GitHub issue sync, MeiliSearch indexing, email via Resend

## Development Guidelines

- NestJS modules: `cd apps/api && nest generate module|service|controller <name>`
- DB changes: edit schema.prisma > `pnpm db:migrate` > `pnpm db:generate`
- All queries must filter by `tenantId`
- Dashboard auth: POST `/api/auth/login` > JWT Bearer
- SDK auth: `x-sdk-key` header
- File upload: request pre-signed URL > upload to S3 > confirm > worker analyzes

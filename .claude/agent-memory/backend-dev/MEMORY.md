# Backend Dev Agent Memory

## Project Architecture

### Controller Locations
- Core modules (auth, tenants, users, applications): `apps/api/src/{module}/`
- Feature modules (tickets, media, agent, analytics, github, integrations, feedback): `apps/api/src/modules/{module}/`
- Health: `apps/api/src/health/`

### Module Registration
- GithubModule is COMMENTED OUT in `app.module.ts` line 120
- AuthModule is at `src/auth/` (NOT `src/modules/auth/`)
- FeedbackModule registered in app.module.ts

### Guard Patterns
- Dashboard endpoints: `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`
- SDK endpoints: `@SdkAuth()` + `@UseGuards(SdkKeyGuard)` + `@ApiSecurity('sdk-key')`
- Public endpoints: `@Public()` decorator
- Older controllers (tenants, users, apps) use `@Request()` for tenantId
- Newer controllers use `@CurrentTenant()` decorator

### DTO Validation Patterns
- Tickets module: Zod schemas + DTOs via `ZodValidationPipe`
- Integrations module: Same Zod pattern
- Media module: Same Zod pattern
- Auth module: class-validator decorators
- Applications module: class-validator decorators
- Users module: class-validator DTOs (UpdateUserDto, CreateUserDto with UserRole enum)
- Tenants module: class-validator DTO (UpdateTenantDto)
- Analytics module: class-validator DTO (AnalyticsQueryDto with AnalyticsPeriod enum)
- Feedback module: class-validator DTOs (CreateFeedbackDto, UpdateFeedbackDto)

### Security Fixes Applied (Remediation Sprint)
- Users controller: RBAC checks (owner/admin only for role changes, create, delete)
- Media download: Tenant verification via media table lookup before presigned URL
- ApplicationsService.getStats: Added tenantId filter to all ticket count queries
- Health endpoints: /health/full, /db, /redis, /cron, /queues, /metrics now require JwtAuthGuard
- GitHub webhook test endpoint removed
- Legacy duplicate controllers removed (github.controller.ts, github-webhook.controller.ts, modules/auth/auth.controller.ts)

### GitHub Integration
- Config location: `src/config/github.config.ts`
- OAuth service: `src/modules/github/services/github-oauth.service.ts`
- App service: `src/modules/github/services/github-app.service.ts` (JWT auth, installation tokens)
- Installation service: `src/modules/github/services/github-installation.service.ts`
- Issues service: `src/modules/github/services/github-issues.service.ts` (auto-create, sync, anti-loop)
- Webhooks service: `src/modules/github/services/github-webhooks.service.ts` (event logging, processing)
- Repos service: `src/modules/github/services/github-repos.service.ts` (list, link, unlink repos)
- ProjectGithubConfig service: `src/modules/github/services/project-github-config.service.ts`
- Webhook processor: `src/modules/github/processors/github-webhook.processor.ts` (BullMQ queue)
- Controllers: github-oauth, github-app, github-installation, project-github, github-repos
- DTOs: project-github-config.dto.ts (ConnectRepoDto, UpdateProjectGithubSettingsDto)
- `isEnabled()` (OAuth): Returns `true` only if BOTH `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
- `isEnabled()` (App): Returns `true` only if BOTH `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` are set
- Setup docs: `docs/GITHUB_OAUTH_SETUP.md`
- Required env vars for GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`
- Required env vars for GitHub App: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_APP_NAME`
- OAuth callback URL: `{API_URL}/api/github/oauth/callback`
- BullMQ queue 'github' used by: TicketsModule (enqueues), GithubWebhookProcessor (processes)
- Anti-loop sync: `setSyncOrigin(ticketId, 'github'|'platform')` / `isSyncFromGithub()` / `isSyncFromPlatform()` via CacheService

### Shared Package (@support-helper/shared)
- Location: `packages/shared/`
- Strict mode enabled via `tsconfig.base.json` inheritance
- NO `any` types, NO `@ts-ignore`, NO `@ts-nocheck` -- all strict rules enforced
- Test files (*.spec.ts, *.test.ts) excluded from build via tsconfig
- Exports: types (Ticket, User, Tenant, Media), constants (severity, ticket-status), utils (validation, encryption)
- Encryption utils: `encryptAES256GCM`, `decryptAES256GCM`, `parseEncryptionKey` -- AES-256-GCM shared between API and Worker
- Used by: API, Worker, SDK, Dashboard, Web
- Build: `pnpm --filter @support-helper/shared build` (tsc)
- Tests: `pnpm --filter @support-helper/shared test` (vitest, 57 tests)

### Testing
- Test framework: Jest for API (*.spec.ts files)
- Test command: `pnpm --filter @support-helper/api test`
- 745 total tests: 725 passed, 20 skipped, 0 failed (as of 2026-02-14)
- Tests located in `apps/api/test/unit/` and `apps/api/test/integration/` directories
- ConfigService must be mocked in tests that inject AuthService (required dependency)
- Test files in `src/` directory are NOT picked up by Jest -- move to `test/unit/` or `test/integration/`
- When adding new dependencies to existing services, ALL test files that instantiate that service must add mocks
- CacheService mock pattern: `{ get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), del: jest.fn(), getOrSet: jest.fn().mockImplementation((_key, _ttl, factory) => factory()) }`
- `@octokit/rest` must be mocked via `jest.mock()` BEFORE imports in GitHub-related test files (ESM issue)
- GitHub service tests need GithubAppService mock: `{ getInstallationOctokit: jest.fn(), isEnabled: jest.fn().mockReturnValue(false) }`

### Key Notes
- `modules/auth/` directory still exists with guards, strategies, middleware -- used by feature modules
- Build command: `pnpm --filter @support-helper/api build`
- bcrypt is available for password hashing
- Windows environment uses Git Bash; `rm -f` works but `del` does not
- WSL environment: Node.js NOT installed natively in WSL, only via Windows path
- Node v24.13.0 (Windows), TypeScript 5.9.3
- `tsconfig.build.json` does NOT exist -- nest build falls back to tsconfig.json
- `nest-cli.json` has standard config: sourceRoot=src, entryFile=main, deleteOutDir=true
- Prisma client must be generated (`prisma generate`) before build -- `.prisma/client` not auto-generated on install
- Required env vars (non-optional): DATABASE_URL, JWT_SECRET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET (AWS SDK standard naming, unified across API and Worker)
- Optional env vars: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET, OPENAI_API_KEY
- dist/ directory exists from previous builds
- Shared package (`@support-helper/shared`) is built and available

### Multi-Tenant Security Audit (Phase 6 - 2026-02-10)
All services verified to filter by tenantId:
- ApplicationsService: ALL queries filter by tenantId ✅
- TicketsService: ALL queries filter by tenantId ✅
- UsersService: ALL queries filter by tenantId ✅
- MediaService: ALL queries verify tenant via ticket.tenantId relation ✅
- AgentService: ALL queries verify tenant via ticket.tenantId relation ✅
- AnalyticsService: ALL queries filter by tenantId ✅
- FeedbackService: ALL queries verify tenant via ticket.tenantId relation ✅
- IntegrationsService: ALL queries filter by tenantId ✅

All controllers have appropriate guards:
- Dashboard controllers: @UseGuards(JwtAuthGuard) + @ApiBearerAuth() ✅
- SDK controllers: @SdkAuth() + @UseGuards(SdkKeyGuard) + @ApiSecurity('sdk-key') ✅
- Public controllers: @Public() decorator (auth, health probes, OAuth callbacks, webhooks) ✅
- GitHub webhooks: @Public() but validates GitHub signature ✅
- Health sensitive endpoints (/full, /db, /redis, etc.): @UseGuards(JwtAuthGuard) ✅

### Integration Providers (2026-02-12)
Location: `apps/api/src/modules/integrations/providers/`

**Discord Provider:**
- `syncTicket()` adds `?wait=true` to webhook URL to receive message ID in response (data.id)
- `updateTicket()` uses PATCH on `/webhooks/{webhook.id}/{webhook.token}/messages/{externalId}`
- `deleteTicket()` uses DELETE on same endpoint, ignores 404 status

**Slack Provider:**
- Uses `@slack/web-api` WebClient
- `externalId` = message timestamp (ts)
- `updateTicket()` uses `chat.update` API
- `deleteTicket()` uses `chat.delete` API

**Notion Provider:**
- Uses `@notionhq/client` Client
- `externalId` = page ID
- `updateTicket()` uses `pages.update` API
- `deleteTicket()` archives page via `pages.update` with `archived: true`

Worker checks `'deleteTicket' in provider` before calling, so adding method is sufficient.

### Agent Conversation (Issue #175)
- API agent service: `apps/api/src/modules/agent/agent.service.ts`
- API agent gateway: `apps/api/src/modules/agent/agent.gateway.ts`
- Worker agent worker: `apps/worker/src/workers/agent.worker.ts`
- `AgentState` enum values are lowercase: `analyzing`, `needs_info`, `proposing`, `waiting`, `resolved`, `escalated`
- `sendMessage()` is synchronous: saves user message, transitions state, generates AI response, returns agent message
- `processUserMessageAsync()` is exposed for worker-side AI processing (typing indicators + state update)
- State transition on user reply: `NEEDS_INFO`/`WAITING` → `ANALYZING` (via `agentSession.update`)
- Timeout scheduling: `scheduleTimeoutJob()` queues `auto-escalate-timeout` with `jobId: timeout:{sessionId}` (24h delay)
- Timeout cancellation: `cancelTimeoutJob()` calls `agentQueue.getJob(jobId)` then `.remove()`
- Gateway `handleSendMessage` must NOT emit typing/messages — that's the service's job (double-emission bug)
- Worker job types `process-user-message` and `auto-escalate-timeout` are in `queue.types.ts`
- `AgentModule` imports `TicketsModule` and `NotificationModule` (for escalation notifications)
- `TicketsGateway` and `NotificationService` are `@Optional()` in `AgentService` constructor

### Agent-V2 Architecture
- Module: `apps/api/src/modules/agent-v2/`
- Services: `DeepAnalysisService`, `AgenticLoopService`, `DiagnosisService`, `CodeInvestigationService`, `ToolExecutorService`
- Gateway: `AgentV2Gateway` (WebSocket)
- Controller: `AgentV2Controller` (`/api/agent/v2/...`)
- Internal endpoint: `POST /api/agent/v2/internal/analyze` (protected by `x-internal-secret` header, `@Public()`)
- Worker delegates to API via HTTP: `apps/worker/src/workers/deep-analysis.worker.ts` calls internal endpoint
- Env var `INTERNAL_API_SECRET` required for worker→API internal calls; `API_URL` defaults to `http://localhost:3001`
- Visual cues flow: VideoAnalysisWorker extracts cues after OCR → saves to `media.metadata.visualCues` → DeepAnalysisService reads and appends to system prompt

### CacheService.del Pattern
- `del(key: string)` deletes a single key — no wildcard support
- For multi-key invalidation, iterate over known keys explicitly

### Stripe Billing Integration (US-AI-16)
- Module: `apps/api/src/modules/billing/`
- Stripe SDK version: v20.4.0, API version: `2026-02-25.clover` (NOT '2024-12-18.acacia')
- `rawBody: true` must be set in `NestFactory.create()` for Stripe webhook signature verification
- Stripe v20 removed `current_period_end` from Subscription — use `billing_cycle_anchor` instead
- Price ID → plan mapping via env vars: `STRIPE_PRICE_PRO` → 'pro', `STRIPE_PRICE_ENTERPRISE` → 'enterprise'
- Webhook controller uses `@Public()` decorator — signature verified via `constructWebhookEvent()`
- Always return HTTP 200 from webhook endpoint even on processing errors (log and continue)
- Dashboard billing page: `apps/dashboard/app/dashboard/settings/billing/page.tsx`
- Dashboard billing API client: `apps/dashboard/lib/api/billing.ts`
- Tests: `apps/api/test/unit/billing/billing.service.spec.ts` (19 tests, all passing)

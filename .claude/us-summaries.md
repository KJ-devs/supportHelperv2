# User Story Summaries

This file is read at the start of each new US to get context from previous work.
After completing a US, append a summary here then `/clear` the context.

---

## [US-SEC-02] #196 InternalAuthGuard Agent-V2 — DONE ✅
- **Files**: `internal-auth.guard.ts` (NEW), `internal-route.decorator.ts` (NEW), `agent-v2.controller.ts`, `agent-v2.module.ts`, `validate-env.ts`, `jwt-auth.guard.ts`, `deep-analysis.worker.ts`, `triage.worker.ts`, 11 test cases
- **Changes**: Dual-factor guard (x-internal-secret + JWT). @Public() removed, @InternalRoute() + @UseGuards(InternalAuthGuard) applied. Worker builds short-lived service JWTs via HMAC.
- **Decisions**: Used @InternalRoute() decorator (like @Public/@SdkAuth) so JwtAuthGuard skips these routes. Service JWT is 5min TTL, no DB lookup.
- **Remaining**: None
- **Date**: 2026-02-28

## [US-SEC-01] #195 Cross-tenant media download tests — DONE ✅
- **Files**: `media.service.spec.ts` (extended), `media-download.e2e-spec.ts` (NEW)
- **Changes**: Added cross-tenant unit test for getDownloadUrlByStorageKey() + 4 E2E tests (own media OK, other tenant 404, no auth 401, unknown key 404)
- **Decisions**: E2E follows existing pattern with isE2EEnvironmentReady() guard and describe.skip fallback
- **Remaining**: None
- **Date**: 2026-02-28

## [US-INFRA-01] #200 Unify S3 variables — DONE ✅
- **Files**: `s3.config.ts`, `validate-env.ts`, `env.validation.ts`, `startup-check.service.ts`, `sdk-tickets.controller.ts`, `docker-compose.prod.yml`, `.env.example`, 3 test files
- **Changes**: Renamed S3_ACCESS_KEY→S3_ACCESS_KEY_ID, S3_SECRET_KEY→S3_SECRET_ACCESS_KEY across all API files. Worker already used correct names.
- **Decisions**: AWS SDK standard naming chosen as canonical
- **Remaining**: None
- **Date**: 2026-02-28

## [US-INFRA-03] #201 Meilisearch key unification — DONE ✅
- **Files**: `meilisearch.service.ts`, `docker-compose.prod.yml`, `apps/worker/.env.example`, `apps/worker/README.md`
- **Changes**: Renamed MEILISEARCH_API_KEY→MEILISEARCH_MASTER_KEY in worker to match docker-compose naming
- **Remaining**: None
- **Date**: 2026-02-28

## [US-SEC-05] #198 Encryption key validation — DONE ✅
- **Files**: `docker-compose.prod.yml`, `apps/worker/src/config/validate-env.ts`, `.env.example`, 12 test files
- **Changes**: Removed empty defaults in docker-compose (${KEY:-}→${KEY:?}), added INTEGRATION_ENCRYPTION_KEY to worker, CRITICAL comments in .env.example
- **Remaining**: None
- **Date**: 2026-02-28

## [US-SEC-03+04] #197+#204 SdkKeyGuard tests — DONE ✅
- **Files**: `sdk-key.guard.spec.ts`
- **Changes**: Added SQL injection test, disabled key test. 100% coverage
- **Remaining**: None
- **Date**: 2026-02-28

## [US-QA-03] #205 Auth tests — DONE ✅
- **Files**: `auth.service.spec.ts`
- **Changes**: Added 6 tests (SSO-only tenant, 4 refresh token, JWT payload). Total 12 auth tests
- **Remaining**: None
- **Date**: 2026-02-28

## [US-QA-04] #206 GitHub OAuth tests — DONE ✅
- **Files**: `github-oauth.service.spec.ts`, `github-oauth.controller.spec.ts`
- **Changes**: Added tenant association + encryption tests, fixed pre-existing TS casts. 30/30 tests
- **Remaining**: None
- **Date**: 2026-02-28

## [US-QA-05] #207 Multi-tenant isolation tests — DONE ✅
- **Files**: `tickets.service.spec.ts`, `media.service.spec.ts`
- **Changes**: Fixed BullMQ DI gap, added 5 cross-tenant + 3 Prisma inspection tests. 62 tests
- **Remaining**: None
- **Date**: 2026-02-28

## [US-SEC-03+QA-02] #199+#203 JwtAuthGuard tests — DONE ✅
- **Files**: `jwt-auth.guard.spec.ts`, `jwt.strategy.spec.ts`, `jwt-auth-module.guard.spec.ts`
- **Changes**: 8 handleRequest tests, @SdkAuth bypass test, fixed import paths. 100% coverage
- **Remaining**: None
- **Date**: 2026-02-28

## [US-INFRA-02] #202 Worker health check — DONE ✅
- **Files**: `docker-compose.prod.yml`, `health.controller.ts`, `health.controller.spec.ts` (NEW)
- **Changes**: Real wget health check, WORKER_PORT:3003, /health/ready returns 503 when not ready. 12 tests
- **Remaining**: None
- **Date**: 2026-02-28

## [US-UX-01] #208 Toast system global — DONE ✅
- **Files**: `Toast.tsx` (NEW), `ConfirmModal.tsx` (NEW), `index.ts`, `layout.tsx`, `IntegrationToast.tsx`, `tickets/[id]/page.tsx`, `applications/page.tsx`, `ExportButton.tsx`, `TicketDetail.tsx`
- **Changes**: Created global Toast + ConfirmModal components. Replaced all alert()/confirm() in tickets, applications, export pages. IntegrationToast re-exports from global Toast.
- **Remaining**: alert/confirm still in agent-tasks and settings pages (not in scope)
- **Date**: 2026-02-28

## [US-UX-02] #209 Socket error clear — DONE ✅
- **Files**: `useTicketSocket.ts`
- **Changes**: Added `socket.io.on('reconnect')` → setError(null) and `socket.io.on('reconnect_failed')` → actionable error message
- **Date**: 2026-02-28

## [US-QA-06] #214 Agent conversation tests — DONE ✅
- **Files**: `agent.service.ts`, `agent.service.spec.ts`
- **Changes**: Added resolveSession() method, closed-session guard on sendMessage(), 4 new tests (19 total)
- **Date**: 2026-02-28

## [US-QA-07] #215 Video analysis DLQ tests — DONE ✅
- **Files**: `video-analysis.worker.spec.ts`
- **Changes**: 20 new tests covering FFmpeg retry, DLQ routing, OCR timeout, GPT-4 rate limit, partial analysis. Fixed 3 pre-existing bugs. 50 tests total
- **Date**: 2026-02-28

## [US-QA-08] #216 Concurrent upload tests — DONE ✅
- **Files**: `media.service.spec.ts`
- **Changes**: 5 tests for simultaneous uploads, double-complete, duplicate checksum, status guards. 36 tests total
- **Date**: 2026-02-28

## [US-QA-09] #217 GitHub sync worker tests — DONE ✅
- **Files**: `github-sync.worker.spec.ts` (NEW), `integration-sync.worker.spec.ts`
- **Changes**: 28 new GithubSyncWorker tests + 8 new integration-sync tests. Covers ticket→issue, credentials, rate limiting, DLQ
- **Date**: 2026-02-28

## [US-QA-10] #218 SDK rate limiting tests — DONE ✅
- **Files**: `sdk-rate-limiting.spec.ts` (NEW), `tenant-rate-limit.guard.spec.ts`, `rate-limiting.spec.ts`
- **Changes**: 35 new tests for throttle behavior, 429 response format, TTL reset, independent counters. Fixed pre-existing DI issues
- **Date**: 2026-02-28

## [US-UX-03] #210 Retry/Dismiss agent chat — DONE ✅
- **Files**: `AgentSection.tsx`, `useAgentChatV2.ts`
- **Changes**: Added Retry/Dismiss buttons on error block, reinitialize() for init failures, lastUserMessageRef for retry, toast on error
- **Date**: 2026-02-28

## [US-UX-04] #220 Socket indicator — DONE ✅
- **Files**: `ConnectionStatus.tsx` (NEW), `DashboardLayout.tsx`
- **Changes**: Green/red/orange dot with tooltip in header showing socket connection state
- **Date**: 2026-02-28

## [US-UX-05] #221 Inline form validation — DONE ✅
- **Files**: `ApplicationModal.tsx`, `settings/ai/page.tsx`, `settings/github/page.tsx`
- **Changes**: Per-field onBlur validation, inline error messages, disabled submit buttons, useToast for server errors
- **Date**: 2026-02-28

## [US-SDK-01] #211 Offline queue IndexedDB — DONE ✅
- **Files**: `offline-queue.ts` (NEW), `widget-api.ts`, `widget-types.ts`, `support-helper-element.ts`, `index.ts`, `offline-queue.test.ts` (NEW)
- **Changes**: IndexedDB queue with exponential backoff (1s-60s), 50 report/500MB limits, auto-flush on reconnect. 21 tests
- **Date**: 2026-02-28

## [US-SDK-03] #212 reportWithVideo() — DONE ✅
- **Files**: `index.ts`, `report-with-video.test.ts` (NEW), `README.md`
- **Changes**: Programmatic API method for non-widget usage. Auto context capture, offline queue integration. 11 tests
- **Date**: 2026-02-28

## [US-SDK-02] #213 Polling post-submit — DONE ✅
- **Files**: `sdk-tickets.controller.ts`, `widget-api.ts`, `widget-types.ts`, `widget-state-machine.ts`, `widget-templates.ts`, `widget-styles.ts`, `support-helper-element.ts`, `poll-ticket-status.test.ts` (NEW)
- **Changes**: GET /api/sdk/tickets/:id endpoint + SDK polling every 5s for 2min. Analyzing UI with spinner, results display, timeout fallback. 15 tests
- **Date**: 2026-02-28

## [US-QA-11] #219 Coverage thresholds — DONE ✅
- **Files**: `jest.config.ts`, `vitest.config.ts`
- **Changes**: Global thresholds (60/70/75/75), stricter auth+guards (85/90/95/95), dashboard (70/70). Removed app/** exclusion
- **Date**: 2026-02-28

## [US-AI-01] #232 Retry + Exponential Backoff AI Providers — DONE ✅
- **Files**:
  - `apps/api/src/ai/providers/ai-retry.util.ts` (NEW) — withRetry() wrapper
  - `apps/worker/src/utils/ai-retry.util.ts` (NEW) — duplicate for worker package
  - `apps/api/src/ai/providers/anthropic.provider.ts` — 4 methods wrapped
  - `apps/api/src/ai/providers/openai.provider.ts` — 5 methods wrapped
  - `apps/api/src/ai/providers/ollama.provider.ts` — 3 fetch calls wrapped
  - `apps/worker/src/services/openai.service.ts` — 8 AI calls wrapped (analyzeVideo×2, classifyTicket×2, generateEmbedding, analyzeFrames, chat, classify)
  - `apps/api/test/unit/ai/ai-retry.util.spec.ts` (NEW) — 29 tests
- **Changes**: Created `withRetry()` utility with exponential backoff (1s×4^attempt), ±20% jitter, Retry-After header support. Retries on 429/500/502/503/529 + network errors. Does NOT retry on 400/401/403/404. Applied to all AI provider methods (API: Anthropic, OpenAI, Ollama) and Worker OpenAIService (8 calls). All 29 tests pass.
- **Decisions**: Custom implementation (no p-retry dependency). Separate copy for worker since it can't import from API package. Each call has a descriptive label for log tracing.
- **Date**: 2026-03-01

## [US-AI-02] #233 Context Pruning dans l'Agentic Loop — DONE ✅
- **Files**:
  - `apps/api/src/modules/agent-v2/agentic-loop.service.ts` — added pruning functions + integration
  - `apps/api/test/unit/services/context-pruning.spec.ts` (NEW) — 17 tests
- **Changes**: Implemented context pruning with: sliding window (keep last 6 messages), mechanical summary of older messages (no AI call), tool_result truncation at 2000 chars, `maxContextTokens` option (default 50K), token estimation (4 chars = 1 token). Always preserves first user message, recent messages, and `update_diagnosis` calls. Logs pruning events with message count and tokens saved.
- **Decisions**: Mechanical summary (no AI call) to avoid extra cost. Exported pure functions (`estimateTokens`, `estimateMessageTokens`, `truncateToolResults`, `pruneMessages`) for testability. Pruning runs before each `provider.chat()` call.
- **Date**: 2026-03-01

## [US-AI-03] #234 Cache Redis des Completions AI — DONE ✅
- **Files**:
  - `apps/api/src/ai/ai-cache.service.ts` (NEW) — AiCacheService with SHA-256 key generation, TTL constants, metrics logging
  - `apps/api/src/ai/ai.service.ts` — wrapped analyzeVideoTranscript (1h), processUserDescription (1h), classifyIssue (4h) with cache
  - `apps/api/src/ai/ai.module.ts` — registered AiCacheService
  - `apps/worker/src/services/openai.service.ts` — added Redis cache on classifyTicket (4h TTL, prefix `ai:completion:classify:`)
  - `apps/api/test/unit/ai/ai-cache.service.spec.ts` (NEW) — 9 tests
- **Changes**: Created `AiCacheService` wrapping existing `CacheService` with AI-specific key generation (SHA-256 of operation+systemPrompt+prompt+model+temperature). Cache applied on 3 API methods + 1 Worker method. Agentic loop and embeddings intentionally NOT cached. Metrics logged every 100 requests.
- **Decisions**: Used `@Optional()` for AiCacheService injection in AIService (graceful degradation if cache unavailable). Worker uses direct ioredis (consistent with existing embedding cache pattern). Key includes temperature to differentiate deterministic vs creative responses.
- **Date**: 2026-03-01

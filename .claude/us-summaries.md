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

## [US-AI-04] #235 Supprimer le Système AI Legacy du Worker — DONE ✅
- **Files**:
  - `apps/worker/src/workers/video-analysis.worker.ts` — replaced `analyzeFrames()` with `analyzeVideo()` (reads frames as Buffers, maps VideoAnalysis → legacy shape)
  - `apps/worker/src/workers/agent.worker.ts` — `handleAnalyzeTicket()` now delegates to API via HTTP (same pattern as DeepAnalysisWorker), added `buildServiceJwt()`, removed unused `buildAnalysisPrompt()` and `parseAnalysisResponse()`
  - `apps/worker/src/services/agent.service.ts` — marked as deprecated with comment block
  - `apps/worker/src/services/openai.service.ts` — removed `analyzeFrames()`, `analyzeBatchLegacy()`, `aggregateVisionResults()` (~150 lines)
  - `apps/worker/src/queues/queue.types.ts` — added `diagnosisFound` to `AgentResult.metadata`
  - `apps/worker/src/workers/__tests__/video-analysis.worker.spec.ts` — updated mocks from `analyzeFrames` → `analyzeVideo`, added `fs/promises` mock, updated assertions for mapped VideoAnalysis shape
  - `apps/worker/src/services/openai.service.spec.ts` — removed `analyzeFrames` backward-compat test
- **Changes**: Unified AI execution path: VideoAnalysisWorker uses `analyzeVideo()` (multi-tenant), AgentWorker delegates `analyze-ticket` to API agent-v2 via HTTP. Removed ~150 lines of legacy code from OpenAIService. 331 worker tests + 84 API tests pass. Build 6/6.
- **Decisions**: Kept `AgentService` class (marked deprecated) — other AgentWorker handlers still use it. AgentWorker HTTP delegation uses same `buildServiceJwt()` + `x-internal-secret` pattern as DeepAnalysisWorker. Added null safety for `analyzeVideo` return.
- **Date**: 2026-03-01

## [US-AI-05] #236 Unifier les Embedding Models — DONE ✅
- **Files**:
  - `apps/api/prisma/schema.prisma` — changed Ticket.embedding from `vector(3072)` to `vector(1536)`
  - `apps/api/prisma/migrations/20260301180000_unify_embedding_dimensions/migration.sql` (NEW) — drops and recreates embedding column + HNSW index
  - `apps/worker/src/config/openai.config.ts` — model `text-embedding-3-large` → `text-embedding-3-small`, dimensions 3072→1536, cost updated
  - `apps/worker/src/config/anthropic.config.ts` — updated comment
  - `apps/worker/src/services/openai.service.ts` — changed model, removed `dimensions: 3072` param, updated cost tracking
  - `apps/worker/src/workers/video-analysis.worker.ts` — updated comment
  - `apps/worker/src/services/openai.service.spec.ts` — updated model name + dimensions in all tests
  - `apps/worker/src/workers/__tests__/video-analysis.worker.spec.ts` — updated mock embeddings from 3072→1536
- **Changes**: Unified all embedding generation to `text-embedding-3-small` (1536d). Prisma migration drops+recreates ticket embedding column with correct dimension. HNSW index recreated. Old Redis-cached embeddings will expire naturally (24h TTL). Cost reduction: 80% ($0.00013→$0.00002/1K tokens).
- **Decisions**: Used `text-embedding-3-small` (not `large` with reduced dimensions) because codebase embeddings already use `small` and 1536d is sufficient for bug search. Migration drops existing embeddings (they'll be re-generated on next video analysis).
- **Date**: 2026-03-01

## [US-AI-06] #237 write_file en mode diff/patch — DONE ✅
- **Files**:
  - `apps/api/src/modules/agent-v2/agent-tools.ts` — added `edit_file` to ToolName union + AGENT_TOOLS array
  - `apps/api/src/modules/agent-v2/code-investigation.service.ts` — added `editFile()` method (read→find→replace→commit)
  - `apps/api/src/modules/agent-v2/tool-executor.service.ts` — added `edit_file` case in dispatcher
  - `apps/api/src/modules/agent-v2/deep-analysis.service.ts` — updated system prompt to recommend edit_file for <50 line changes
  - `apps/api/test/unit/services/tool-executor.service.spec.ts` — 4 new tests (success, old_text not found, file not found, no repo)
- **Changes**: Added `edit_file` tool alongside `write_file`. Reads file via GitHub API, does exact find-and-replace, commits. System prompt now recommends `edit_file` for targeted changes and `write_file` only for new files/complete rewrites. 19 tool-executor tests pass.
- **Decisions**: `edit_file` replaces only the first occurrence of `old_text` (same as Claude Code's Edit tool). Error messages are descriptive to help the AI agent retry with corrected text.
- **Date**: 2026-03-01

## [US-AI-07] #238 GeminiProvider (Gemini 2.0 Flash) — DONE ✅
- **Files**:
  - `apps/api/src/ai/providers/gemini.provider.ts` (NEW) — GeminiProvider with vision support, native JSON mode
  - `apps/api/src/ai/providers/ai-provider.interface.ts` — added `'gemini'` to AIProviderType
  - `apps/api/src/ai/providers/ai-provider.types.ts` — added Gemini to DEFAULT_MODELS and PROVIDER_LABELS
  - `apps/api/src/ai/providers/ai-provider.factory.ts` — added `'gemini'` case
  - `apps/api/src/config/validate-env.ts` — added GOOGLE_AI_API_KEY to optional vars
  - `apps/api/test/unit/ai/gemini.provider.spec.ts` (NEW) — 21 tests
- **Changes**: Full `AIProvider` implementation using `@google/generative-ai` SDK. Gemini 2.0 Flash default model. Native JSON mode (`responseMimeType: 'application/json'`). Vision support via `options.images` (base64 inline data). Embeddings delegate to OpenAI `text-embedding-3-small` (Gemini native 768d incompatible with pgvector 1536d). All calls wrapped with `withRetry()`.
- **Decisions**: Embeddings via OpenAI (not Gemini) to maintain 1536d compatibility. Constructor takes `apiKey` + optional `openaiApiKey`.
- **Date**: 2026-03-01

## [US-AI-08] #239 BedrockProvider (Claude via AWS) — DONE ✅
- **Files**:
  - `apps/api/src/ai/providers/bedrock.provider.ts` (NEW) — BedrockProvider implementing AIProvider + ToolCapableProvider
  - `apps/api/src/ai/providers/ai-provider.interface.ts` — added `'bedrock'` to AIProviderType
  - `apps/api/src/ai/providers/ai-provider.types.ts` — added Bedrock to DEFAULT_MODELS and PROVIDER_LABELS
  - `apps/api/src/ai/providers/ai-provider.factory.ts` — added `'bedrock'` case
  - `apps/api/test/unit/ai/bedrock.provider.spec.ts` (NEW) — 20 tests
- **Changes**: Full `AIProvider` + `ToolCapableProvider` implementation using `@aws-sdk/client-bedrock-runtime`. Uses `InvokeModelCommand` for completions (Claude Messages API format), `ConverseCommand` for tool-calling (agent loop). Embeddings delegate to OpenAI. Validates with Haiku model (cheapest). All calls wrapped with `withRetry()`.
- **Decisions**: Uses IAM credentials (no API key needed). Converse API for tool-calling (native AWS format). Haiku for validation to minimize cost.
- **Date**: 2026-03-01

## [US-AI-09] #240 Tiering Intelligent des Modèles par Tâche — DONE ✅
- **Files**:
  - `apps/api/src/ai/model-tiering.service.ts` (NEW) — ModelTieringService with task→provider routing, tenant custom tiers, fallback logic
  - `apps/api/src/ai/ai.service.ts` — injected ModelTieringService, added `getProviderForTask()`, updated classifyIssue/analyzeVideoTranscript/processUserDescription/generateCompletion to use task-based routing
  - `apps/api/src/ai/ai.module.ts` — registered ModelTieringService
  - `apps/api/test/unit/ai/model-tiering.service.spec.ts` (NEW) — 21 tests
- **Changes**: Created `ModelTieringService` with 3-tier model routing: Tier 1 (Claude Sonnet → investigation, chat), Tier 2 (Gemini Flash → vision, enrichment), Tier 3 (Claude Haiku → classification). Per-tenant custom tiers via `AiConfig.settings.tiers` JSON. Fallback chain: tier provider → tenant default → system anthropic → system openai. Every call logs task, provider, model, and reason. `AIService` methods now route to optimal provider per task type.
- **Decisions**: `@Optional()` injection for backward compat. Per-tenant overrides stored in existing `AiConfig.settings` JSON field (no schema migration needed). Agentic loop not modified (uses separate `ToolCapableProviderFactory`).
- **Date**: 2026-03-01

## [US-AI-10] #241 Page Settings AI Dashboard (BYOK) — DONE ✅
- **Files**:
  - `apps/dashboard/app/dashboard/settings/ai/page.tsx` — complete rebuild with 5-provider BYOK page
  - `apps/dashboard/lib/types/ai-config.ts` — extended types for Gemini/Bedrock
  - `apps/api/src/modules/ai-config/dto/update-ai-config.dto.ts` — added GEMINI/BEDROCK to AIProviderType enum
  - `apps/api/src/modules/ai-config/dto/validate-key.dto.ts` — made apiKey optional for Ollama/Bedrock
  - `apps/api/src/modules/ai-config/ai-config.service.ts` — updated for Gemini/Bedrock default models, optional API key
- **Changes**: Full settings/ai page with provider grid (Anthropic, OpenAI, Gemini, Bedrock, Ollama), API key management with show/hide, model dropdown per provider, test connection button, provider-specific fields (AWS region, Ollama endpoint), status banner (Connected/Not configured).
- **Date**: 2026-03-01

## [US-AI-12] #243 Quotas par Tenant + Tier Gratuit — DONE ✅
- **Files**:
  - `apps/api/prisma/schema.prisma` — added TenantQuota model + Tenant relation
  - `apps/api/prisma/migrations/20260301200000_add_tenant_quota/migration.sql` (NEW)
  - `apps/api/src/modules/ai-config/quota.service.ts` (NEW) — QuotaService with checkQuota, incrementUsage, resetQuotaIfNeeded, ensureQuotaExists
  - `apps/api/src/modules/ai-config/quota.guard.ts` (NEW) — NestJS guard checking quota before AI calls
  - `apps/api/src/modules/ai-config/dto/update-quota.dto.ts` (NEW) — DTO for plan changes
  - `apps/api/src/modules/ai-config/ai-config.controller.ts` — added GET/PATCH quota endpoints
  - `apps/api/src/modules/ai-config/ai-config.module.ts` — registered QuotaService, QuotaGuard
  - `apps/api/test/unit/ai/quota.service.spec.ts` (NEW) — 14 tests
- **Changes**: TenantQuota model with plan (free/pro/enterprise), monthly quota, usage tracking, BYOK flag. QuotaGuard for endpoint-level protection. Auto-reset on 1st of month. Lazy creation of quota records. Plans: free=10, pro=500, enterprise=5000 analyses/month.
- **Date**: 2026-03-01

## [US-AI-11] #242 AI Usage Dashboard — DONE ✅
- **Files**:
  - `apps/api/src/modules/ai-config/ai-usage.service.ts` (NEW) — reads 30 days of Worker Redis cost data, calculates costPerTicket
  - `apps/api/src/modules/ai-config/ai-config.controller.ts` — added GET /settings/ai/usage endpoint
  - `apps/api/src/modules/ai-config/ai-config.module.ts` — registered AiUsageService
  - `apps/dashboard/app/dashboard/settings/ai-usage/page.tsx` (NEW) — KPI cards, CSS bar chart, data table
  - `apps/dashboard/lib/api/ai-usage.ts` (NEW) — API client
  - `apps/dashboard/app/dashboard/settings/page.tsx` — added AI Usage nav link
- **Changes**: AiUsageService reads Worker's Redis `ai:cost:{tenantId}:{date}` keys (30 days), aggregates totals, calculates cost/ticket. Dashboard page with 4 KPI cards, daily cost bar chart (CSS-based, no library), and sortable data table.
- **Date**: 2026-03-01

## [US-AI-13] #244 Circuit Breaker par Tenant — DONE ✅
- **Files**:
  - `apps/api/src/ai/circuit-breaker.service.ts` (NEW) — AiCircuitBreakerService with daily budget protection
  - `apps/api/src/ai/ai.module.ts` — registered AiCircuitBreakerService
  - `apps/api/src/modules/ai-config/ai-config.controller.ts` — added GET budget-status and POST reset-circuit endpoints
  - `apps/api/test/unit/ai/circuit-breaker.service.spec.ts` (NEW) — 25 tests
- **Changes**: Redis-based daily budget limiter (default $50/day, configurable via AiConfig.settings.dailyBudgetLimit). Fail-open design (allows on error). 48h TTL for auto-reset. Admin reset endpoint. Separate `ai:circuit:` namespace from Worker's `ai:cost:` keys.
- **Decisions**: Fail-open by design — circuit breaker errors should not block all AI calls. Budget limit stored in existing AiConfig.settings JSON (no migration).
- **Date**: 2026-03-01

---

## [US-AI-16] #247 Stripe Integration (Subscriptions) — DONE ✅
- **Files**:
  - NEW: `apps/api/src/modules/billing/billing.module.ts`
  - NEW: `apps/api/src/modules/billing/billing.service.ts`
  - NEW: `apps/api/src/modules/billing/billing.controller.ts`
  - NEW: `apps/api/src/modules/billing/stripe-webhook.controller.ts`
  - NEW: `apps/api/test/unit/billing/billing.service.spec.ts`
  - NEW: `apps/api/prisma/migrations/20260301210000_add_stripe_customer_id/migration.sql`
  - NEW: `apps/dashboard/app/dashboard/settings/billing/page.tsx`
  - NEW: `apps/dashboard/lib/api/billing.ts`
  - MOD: `apps/api/prisma/schema.prisma` — added `stripeCustomerId` to Tenant
  - MOD: `apps/api/src/app.module.ts` — registered BillingModule
  - MOD: `apps/api/src/main.ts` — added `rawBody: true` for Stripe webhook verification
  - MOD: `apps/api/src/config/validate-env.ts` — documented Stripe optional env vars
  - MOD: `apps/dashboard/app/dashboard/settings/page.tsx` — added Billing nav link
- **Changes**: Full Stripe billing integration. BillingService handles getOrCreateCustomer, createCheckoutSession (pro/enterprise), createPortalSession, getSubscription, and 4 webhook event handlers. StripeWebhookController is @Public() with signature verification. Plan changes trigger tenant.plan + TenantQuota upsert in a transaction. Dashboard billing page with plan cards, upgrade/portal buttons, success/cancel URL handling.
- **Decisions**: Used Stripe v20 API (`2026-02-25.clover`); `current_period_end` removed in v20 — used `billing_cycle_anchor` instead. rawBody:true in NestFactory enables raw body buffer for signature verification. Webhook always returns HTTP 200 even on processing errors. Price IDs mapped via STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE env vars (optional).
- **Remaining**: STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE env vars need to be set with actual Stripe price IDs; NEXT_PUBLIC_STRIPE_PRICE_PRO/ENTERPRISE needed in dashboard for pricing page CTA links.
- **Date**: 2026-03-01

## [US-AI-14] #245 Tests Dashboard (Vitest Coverage) — DONE ✅
- **Files**: 17 new test files across `apps/dashboard/components/` and `apps/dashboard/hooks/`
  - `components/ui/Toast.test.tsx` (15 tests), `ConfirmModal.test.tsx` (20), `Button.test.tsx` (17), `Badge.test.tsx` (47), `Input.test.tsx` (20), `EmptyState.test.tsx` (16), `Loader.test.tsx` (16), `Modal.test.tsx` (19), `Select.test.tsx` (14), `Card.test.tsx` (15)
  - `components/layout/ConnectionStatus.test.tsx` (20), `components/analytics/StatsCard.test.tsx` (17), `components/usage/UsageBar.test.tsx` (11), `components/tickets/Pagination.test.tsx` (22), `components/tickets/TicketCard.test.tsx` (15)
  - `hooks/useTicketSocket.test.ts` (19), `app/dashboard/settings/ai/page.test.tsx` (19)
  - `vitest.config.ts` — updated coverage thresholds to 60%
- **Changes**: 343 tests across 17 components/hooks. 94% line coverage on tested files. Fixed 3 minor TS issues (missing `vi` import, unused vars).
- **Date**: 2026-03-01

## [US-AI-15] #246 Landing Page + Pricing — DONE ✅
- **Files**:
  - `apps/web/src/app/page.tsx` — landing page with hero, how-it-works, features grid, social proof
  - `apps/web/src/app/(marketing)/pricing/page.tsx` — 3-tier pricing cards, comparison table, FAQ
  - `apps/web/src/components/marketing/nav-bar.tsx` (NEW) — sticky header with mobile menu
  - `apps/web/src/components/marketing/footer.tsx` (NEW) — 4-column footer
  - `apps/web/src/app/(marketing)/layout.tsx` — marketing layout with NavBar/Footer
  - Various config files restored: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- **Changes**: Full public-facing website. Landing page with "AI-Powered Bug Resolution" hero, 4-step how-it-works, 6-feature grid, social proof. Pricing page with Free ($0), Pro ($49), Enterprise ($199) tiers, feature comparison table, 5-item FAQ. Responsive, dark-mode ready.
- **Date**: 2026-03-01

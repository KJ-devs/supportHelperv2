# QA Engineer Memory - Support Helper Platform

## Playwright E2E — Critical Infrastructure Note

- **NEVER run Playwright against the Next.js dev server (HMR mode)** — the dev server recompiles so fast that `main-app.js?v=X` returns 404 by the time the browser requests it (server already at v=X+N). React never hydrates, form submits fire as native browser submits → login fails.
- **Always run Playwright against `next start` (production build)** — requires `pnpm build` first, then `npx next start -p 3010` on a free port.
- **Production server Sentry issue**: if `.next/server/webpack-runtime.js` throws `Cannot find module './vendor-chunks/@sentry+core@8.55.0.js'`, the build is stale/incomplete — run `pnpm build` fresh before `next start`.
- **Auth helper**: `apps/dashboard/e2e/helpers/auth.ts` uses `pressSequentially` (not `fill`) to trigger React onChange on controlled inputs. Correct pattern for this codebase.
- **Auth login form**: uses `id="email"` and `id="password"` (no `name` attribute). The login doesn't use next-auth, uses custom JWT with localStorage. After submit, redirects to `/dashboard` via `router.push`.

## Test Architecture

- API tests use Jest with `@nestjs/testing` module
- SDK tests use Vitest with browser mocks (jsdom)
- Dashboard tests use Vitest + @testing-library/react (unit tests) and Playwright (e2e)
- Dashboard unit tests: `apps/dashboard/components/**/__tests__/*.test.tsx`
- Shared package tests use Vitest
- Database package tests use Vitest with conditional skip for integration tests
- E2E tests conditionally skip based on environment variables (TEST_DATABASE_URL, TEST_REDIS_URL, TEST_S3_ENDPOINT)

## Critical: Jest Config Discovery

- Jest `projects` config OVERRIDES top-level `testMatch`
- Only `test/unit/**` and `test/integration/**` are discovered by Jest
- Colocated tests in `src/**/*.spec.ts` are NOT picked up by the current jest.config.ts
- Always put API tests under `apps/api/test/unit/` for them to run

## Test File Locations

- **Discovered** unit tests: `apps/api/test/unit/` (guards/, controllers/, services/)
- Colocated tests in src/ are NOT discovered (jest projects config override)
- External unit tests: `apps/api/test/unit/`
- E2E tests: `apps/api/test/e2e/`
- Integration tests: `apps/api/test/integration/`
- SDK tests: `packages/sdk-web/tests/`
- Worker tests: `apps/worker/src/services/*.spec.ts`
- Shared tests: `packages/shared/src/**/*.spec.ts`
- Database tests: `packages/database/tests/`
- Dashboard unit tests: `apps/dashboard/components/**/__tests__/*.test.tsx`
- Dashboard setup: `apps/dashboard/tests/setup.tsx`
- Web app tests: `apps/web/tests/`

## Mock Patterns

- PrismaService: mock object with `jest.fn()` for each Prisma model method, `$executeRaw` returns number (affected rows)
- ConfigService: mock with `get: jest.fn()` returning config values
- External libs (OpenAI, Octokit, ffmpeg, AWS SDK, BullMQ, ioredis): `jest.mock()` at module level
- Winston logger: mock with `jest.mock('winston')` and `createLogger` returning mock logger object
- Logtail: mock with `jest.mock('@logtail/node')` and `jest.mock('@logtail/winston')`
- S3Service, FFprobeService: use `jest.spyOn()` on service methods
- BullMQ Queue: mock with `add: jest.fn().mockResolvedValue({ id: 'job-123' })`
- Integration providers: mock at module level with `jest.mock()`, then use `mockImplementation()` in tests to return provider instances
- Encrypted configs: use helper function that calls `encryptAES256GCM()` to create properly encrypted test data
- WebSocket gateways: mock with `emitSessionUpdate`, `emitNewMessage`, `emitAgentTyping` as `jest.fn()`
- Circular dependencies: use `forwardRef()` in production code, plain mocks in tests (no need to replicate forwardRef)
- Passport strategies: extend from PassportStrategy, mock AuthService for validate() method testing
- Express Request: use `as unknown as Request` for partial mock objects (more strict than `as any as Request`)
- ExecutionContext: create mock with switchToHttp().getRequest/getResponse for interceptors/guards
- CallHandler: mock with `handle: jest.fn().mockReturnValue(of(data))` for interceptors
- ArgumentsHost: mock with switchToHttp().getRequest/getResponse for exception filters
- NestJS Logger: spy on `Logger.prototype` methods in beforeEach, reuse spies across tests (don't recreate per test)

## Known Gaps (as of 2026-02-18)

- ai/ai.service.ts has ZERO tests
- SDK widget element and state machine have ZERO tests
- Worker services mostly untested (openai.service is tested)
- 5 GitHub controllers untested
- No DTO validation tests
- tenant-rate-limit.guard has no tests (ThrottlerGuard subclass)
- VideoAnalysisWorker: FULLY TESTED (50 tests, 30 pre-existing + 20 US-215 additions) - NOT a gap

## Tests Added (2026-02-28 US-215 VideoAnalysis Retry/DLQ)

- VideoAnalysisWorker -> `apps/worker/src/workers/__tests__/video-analysis.worker.spec.ts` (20 new tests, 50 total)
- Fixed pre-existing bugs: `as unknown` cast → `as unknown as Job<T>` (TS2322), missing `media.findUnique` mock, wrong `media.update` call count (2→3, saveVisualCues adds extra call)
- New tests: AC1 FFmpeg retry no DLQ, AC2 DLQ payload on attempt 4/4, AC3 OCR timeout media status, AC4 GPT-4 rate limit retryability, AC5 partial analysis no DB write, AC6 full DLQ payload structure
- Retry boundary: parameterized test covering attempts 1-4 with `it.each`
- Pattern for DLQ payload: use `(deadLetterQueue.add as jest.Mock).mock.calls[0]![1]` to destructure and assert all fields
- Gotcha: `saveVisualCues` calls `prisma.media.findUnique` (needs mock) AND `prisma.media.update` (3rd update call in happy path after processing+visualCues+completed)
- Gotcha: worker test suites `integration-sync.worker.spec.ts`, `backup.worker.spec.ts`, `openai.service.spec.ts`, `dlq-cleanup.worker.spec.ts`, `dlq-cleanup.service.spec.ts` had pre-existing TS errors — now all FIXED (2026-02-28)
- Worker TS fix patterns: `noUnusedLocals: true` in worker tsconfig → underscore prefix does NOT suppress TS6133, must REMOVE the unused variable declaration entirely; `(service as unknown).prop` = TS2571, must use `(service as any).prop`; `call[1]?.includes()` on `unknown[]` → `(call[1] as string)?.includes()`
- OpenAI service test gotcha: `openai.service.spec.ts` routes to OpenAI path (not Anthropic) when `openaiConfig.apiKey` is set in mock but no `ANTHROPIC_API_KEY` env var. Mock must include `chat.completions.create` for analyzeVideo/classifyTicket tests. `RATE_LIMIT = 10000` (not 50) — tests must use actual constant value.

## Tests Added (2026-02-08 remediation)

- Auth guards: jwt-auth, sdk-key (common), tenant, roles -> `test/unit/guards/`
- SDK tickets controller -> `test/unit/controllers/sdk-tickets.controller.spec.ts`
- Users controller (with RBAC) -> `test/unit/controllers/users.controller.spec.ts`
- Tenants controller -> `test/unit/controllers/tenants.controller.spec.ts`
- Total: 82 tests across 7 files, all passing

## Tests Added (2026-02-09 VideoPlayer)

- VideoPlayer component -> `apps/dashboard/components/media/__tests__/VideoPlayer.test.tsx`
- Coverage: 21 tests covering MediaError handling, UI state, error recovery, console logging
- Setup: Added vitest config and test setup with MediaError mock for dashboard app
- All tests passing

## Tests Added (2026-02-12 Integration Sync)

- IntegrationsSyncService -> `apps/api/test/unit/services/integrations-sync.service.spec.ts`
- IntegrationSyncWorker -> `apps/worker/src/workers/__tests__/integration-sync.worker.spec.ts`
- Coverage: 36 tests total (19 API + 17 worker)
- API tests: create/update/delete actions, SDK options filtering, priority handling
- Worker tests: provider calls, encryption/decryption, retry logic, error handling
- All tests passing

## Tests Added (2026-02-13 Environment Validation)

- API env validation -> `apps/api/test/unit/config/validate-env.spec.ts` (23 tests)
- Worker env validation -> `apps/worker/src/config/__tests__/validate-env.spec.ts` (11 tests)
- Coverage: 34 tests total covering missing vars, invalid values, valid configs, error messages, edge cases
- Validates: DATABASE_URL, REDIS_URL, JWT secrets, OPENAI_API_KEY, S3 config, INTEGRATION_ENCRYPTION_KEY
- Security: Rejects insecure defaults for JWT_SECRET ("secret", "change-me", example default)
- Format validation: OPENAI_API_KEY must start with "sk-", encryption key must be 64 hex chars
- All tests passing - validation is production-ready

## Tests Added (2026-02-14 Agent & Auth Modules)

- AgentService -> `apps/api/test/unit/services/agent.service.spec.ts` (9 tests)
- AuthService (modules/auth) -> `apps/api/test/unit/services/auth-module.service.spec.ts` (17 tests)
- Coverage: 26 tests total covering session management, message handling, authentication flows
- AgentService tests: startSession, getSession, sendMessage with WebSocket gateway integration
- AuthService tests: register, login, refresh, validateUser, validateApiKey (JWT + SDK key auth)
- All tests passing

## Tests Added (2026-02-14 Tickets Module)

- TicketsService -> `apps/api/test/unit/services/tickets.service.spec.ts` (25 tests)
- TicketsController -> `apps/api/test/unit/controllers/tickets.controller.spec.ts` (17 tests)
- Coverage: 42 tests total covering CRUD operations, filtering, pagination, stats, search integration
- Service tests: create, findAll (with filters/pagination/search), findOne, update, remove, assign, getStats
- Controller tests: create with AI analysis + search indexing + integration sync, findAll, findOne, findSimilar, update, assign, remove
- Patterns: Zod schema DTOs with strict enum types (must use `as const`), FilterTicketsDto has required fields with defaults
- Gotcha: `findOne` is called internally by update/remove/assign - mocks must include `media`, `githubIssues`, `agentSessions` arrays
- All tests passing

## Tests Added (2026-02-14 Media Module)

- S3Service -> `apps/api/test/unit/services/s3.service.spec.ts` (16 tests)
- MediaService -> `apps/api/test/unit/services/media.service.spec.ts` (29 tests)
- MediaController -> `apps/api/test/unit/controllers/media.controller.spec.ts` (20 tests)
- Coverage: 65 tests total covering S3 operations, file upload flow, media CRUD, video analysis queueing
- S3 tests: presigned URLs (upload/download), object exists/metadata/delete, storage key generation, public URLs
- Service tests: requestUploadUrl (with plan limits), completeUpload (checksum verification, metadata extraction, video analysis queue), findByTicket, findOne, remove, video events, cleanup
- Controller tests: all endpoints including redirect download, pagination for video events
- **Source fix required**: Fixed FFprobe service TypeScript errors - changed from `import * as ffmpeg` to default `import ffmpeg` (namespace imports not callable)
- Patterns: Mock BullMQ queue with `getQueueToken('video-analysis')`, S3Service mocked at module level with `jest.mock()`, BigInt handling in Prisma models
- Gotcha: `completeUpload` calls `prisma.media.update` 3 times (duration + completion + processing status), not 2
- All 65 tests passing

## Tests Added (2026-02-14 Analytics, Health, Integrations Services)

- AnalyticsService -> `apps/api/test/unit/services/analytics.service.spec.ts` (16 tests)
- HealthService -> `apps/api/test/unit/services/health.service.spec.ts` (24 tests)
- IntegrationsService -> `apps/api/test/unit/services/integrations.service.spec.ts` (30 tests)
- Coverage: 70 tests total covering dashboard analytics, service health monitoring, third-party integrations
- Analytics tests: getOverview (period filters: day/week/month), getTrends (date grouping), getPerformanceMetrics (resolution rate), getAgentStats (per-agent metrics), getApplicationStats (per-app metrics)
- Health tests: getBasicHealth, getFullHealth (degraded/unhealthy states), checkDatabase, checkRedis (with ioredis mock), checkMemory (heap threshold), cron job tracking, BullMQ queue monitoring, isAlive/isReady
- Integrations tests: create (validation, encryption), findAll (filtering), findOne, update (re-encryption), delete, testConnection, getAvailableTypes, getSyncLogs (pagination, filters), getSyncStats
- Patterns: Mock ioredis with module-level `jest.mock('ioredis')`, mock integration providers with `jest.mock()` on providers index, isolate ConfigService instances for "not configured" scenarios
- Gotchas: HealthService lazy-initializes Redis - tests that mock config.get(null) must create new service instance to avoid shared state pollution. Mock rejections in Redis tests need `Promise.reject()` wrapper to avoid sync throw.
- All 70 tests passing

## Tests Added (2026-02-14 Logger, Auth Strategies & Guards)

- LoggerService -> `apps/api/test/unit/services/logger.service.spec.ts` (31 tests)
- JwtStrategy (modules/auth) -> `apps/api/test/unit/auth/jwt.strategy.spec.ts` (9 tests, +2 constructor tests 2026-02-28)
- ApiKeyStrategy -> `apps/api/test/unit/auth/api-key.strategy.spec.ts` (7 tests)
- ApiKeyGuard -> `apps/api/test/unit/auth/api-key.guard.spec.ts` (5 tests)
- JwtAuthGuard (common) -> `apps/api/test/unit/guards/jwt-auth.guard.spec.ts` (15 tests, +8 added 2026-02-28: @SdkAuth bypass + handleRequest cases)
- JwtAuthGuard (modules/auth) -> `apps/api/test/unit/auth/jwt-auth-module.guard.spec.ts` (6 tests, fixed broken import 2026-02-28)
- TenantGuard -> `apps/api/test/unit/auth/tenant.guard.spec.ts` (10 tests)
- Patterns: Mock winston with `jest.mock('winston')`, use `as unknown as jest.Mocked<T>` for partial mocks (NOT just `as unknown`)
- Gotchas: Guards must check both handler and class for @Public metadata. `jwt-auth-module.guard.spec.ts` was importing non-existent `src/modules/auth/guards/jwt-auth.guard` — fixed to `src/common/guards/jwt-auth.guard`
- handleRequest testing: test with (null, false, info) for expired/invalid/missing token scenarios; passport-jwt never calls validate() for these — they are handled before JwtStrategy.validate()
- @SdkAuth() decorator uses key `IS_SDK_ROUTE_KEY = 'isSdkRoute'` (in `src/common/decorators/sdk-auth.decorator.ts`)
- All tests passing, jwt-auth.guard.ts coverage: 100% statements/branches/functions/lines

## Tests Added (2026-02-14 Interceptors, Filters, Middleware)

- GithubWebhookProcessor -> `apps/api/test/unit/services/github-webhook.processor.spec.ts` (11 tests)
- HttpExceptionFilter -> `apps/api/test/unit/common/http-exception.filter.spec.ts` (13 tests)
- LoggingInterceptor -> `apps/api/test/unit/common/logging.interceptor.spec.ts` (10 tests)
- TransformInterceptor -> `apps/api/test/unit/common/transform.interceptor.spec.ts` (11 tests)
- CorrelationIdMiddleware -> `apps/api/test/unit/common/correlation-id.middleware.spec.ts` (9 tests)
- TenantContextMiddleware -> `apps/api/test/unit/auth/tenant-context.middleware.spec.ts` (13 tests)
- Coverage: 67 tests total covering webhook processing, exception filtering, request logging, response transformation, correlation IDs, tenant context
- Webhook tests: issue/PR/push/comment events, unhandled events, error handling, lifecycle hooks (onCompleted, onFailed)
- Filter tests: HttpException handling (string/object response), standard Error, unknown exceptions, logging, timestamp formatting, HTTP methods
- Interceptor tests: LoggingInterceptor (request/response logging, elapsed time, user-agent, body logging), TransformInterceptor (data wrapping, timestamp, path, primitives/objects/arrays/null/undefined)
- Middleware tests: CorrelationIdMiddleware (header extraction, UUID generation, response header), TenantContextMiddleware (PostgreSQL session variable, RLS, SQL injection prevention via parameterized queries)
- Patterns: Mock ExecutionContext with switchToHttp().getRequest/getResponse, CallHandler with handle().pipe(of(data)), ArgumentsHost for filters, Express Request/Response with `as unknown as Request`
- Gotchas: NestJS Logger.prototype spies must be managed in beforeEach - create once and reuse. HttpException with string message doesn't set `error` field (stays default). Prisma $executeRaw with template literals is called with array + values as separate arguments (not object with strings/values). Express partial mocks need `as unknown as Type` to avoid TypeScript strict errors.
- All 67 tests passing

## Tests Added (2026-02-18 VideoAnalysis Worker - Issue #121)

- VideoAnalysisWorker -> `apps/worker/src/workers/__tests__/video-analysis.worker.spec.ts` (30 tests)
- Coverage: 96.87% statements, 92.1% branches, 88.88% functions, 96.82% lines
- Tests pass in ~6 seconds (well within 30s limit)
- All pipeline steps tested: S3 download, FFmpeg extraction, OCR, YOLO, GPT-4 Vision, embeddings, DB update, Meilisearch index
- All error cases: S3 failure, FFmpeg failure (corrupt video), OCR timeout, OpenAI API error, embedding failure
- Options tested: skipOcr, skipYolo, skipVision, maxFrames
- Cleanup verified (finally block runs on both success and error)
- Retry logic: exponential backoff delays [1min, 5min, 15min, 1hr]
- Worker events: onActive, onCompleted, onFailed (including dead-letter queue on max retries)
- The file already existed with full coverage - no changes needed

## Tests Added (2026-02-17 Integration Providers E2E)

- Integration providers E2E -> `apps/api/test/integration/integrations-e2e.spec.ts` (35 tests)
- Coverage: Jira, Slack, HubSpot, Discord providers with full CRUD lifecycle
- Jira tests (6): connection, create/update issues, pull tickets, rate limiting
- Slack tests (5): connection, post/update/delete messages, channel history
- HubSpot tests (6): connection, create/update/delete tickets, pull with search API
- Discord tests (5): webhook test, post/update/delete messages, error handling
- Integration CRUD (5): create, update, delete with encryption, list filtering, connection testing
- Error handling (4): network timeout, invalid JSON, validation (required/optional fields)
- Config encryption (4): encrypt/decrypt with AES-256-GCM, re-encryption on update, invalid config
- Patterns: Mock `global.fetch` for REST APIs, `jest.mock('@slack/web-api')` for Slack SDK
- Gotcha: IntegrationsCryptoService uses `encrypt(plaintext)` returning `{ciphertext, iv}` and `decrypt(ciphertext, iv)`, NOT `encryptConfig/decryptConfig`
- Gotcha: Integration model has NO `syncDirection` field - removed from all test fixtures
- Gotcha: Must provide ConfigService mock in TestingModule for IntegrationsCryptoService to initialize
- All 35 tests passing (skip gracefully without TEST_DATABASE_URL)

## Tests Added (2026-02-28 Multi-Tenant Isolation US-QA-05)

- tickets.service.spec.ts: fixed missing `deep-analysis` and `triage` queue providers (all 25 pre-existing tests were failing)
- tickets.service.spec.ts: added 5 cross-tenant negative tests (findOne/findAll/update isolation + 3-test Prisma query inspection block)
- media.service.spec.ts: added 1 cross-tenant negative test for findByTicket
- Total: 6 new tests, all passing
- Pattern for Prisma query inspection: call `.mock.calls[0][0]` on the mocked fn, then `toMatchObject({ tenantId: X })` on the `.where` field
- Gotcha: TicketsService now injects 3 queues (github, deep-analysis, triage) — all 3 must be provided in TestingModule or ALL tests in the suite fail with DI error

## Tests Added (2026-02-28 US-217 GitHub Sync Full Flow)

- GithubSyncWorker -> `apps/worker/src/workers/__tests__/github-sync.worker.spec.ts` (28 new tests)
- Extended IntegrationSyncWorker -> `apps/worker/src/workers/__tests__/integration-sync.worker.spec.ts` (+8 tests, 27 total)
- See `github-sync-tests.md` for patterns and gotchas

## Tests Added (2026-02-28 US-218 SDK Rate Limiting)

- Fixed `test/unit/guards/tenant-rate-limit.guard.spec.ts`: added missing DI providers (THROTTLER_OPTIONS, ThrottlerStorage, Reflector), fixed prisma mock type cast, added 5 more tests (12 total)
- Fixed `test/integration/rate-limiting.spec.ts`: `as unknown as jest.Mocked<Redis>` (not just `as unknown`)
- New `test/unit/rate-limiting/sdk-rate-limiting.spec.ts` (35 tests): covers all 5 ACs
- Key gotchas:
  - @nestjs/throttler v5 stores metadata as `THROTTLER:LIMIT{name}` and `THROTTLER:TTL{name}` keys, NOT a single `THROTTLE_METADATA` key
  - Method-level `@Throttle()` overrides module-level limit (guard reads `routeOrClassLimit || namedThrottler.limit`)
  - AC3 tests must use `limit=10` in the module to match the `@Throttle({ public: { limit: 10 } })` on auth controller methods
  - InMemoryThrottlerStorage with `flush()` method enables AC4 TTL-reset tests without real Redis
  - TenantRateLimitGuard requires THROTTLER_OPTIONS, ThrottlerStorage, Reflector, PrismaService in TestingModule
  - `super.generateKey` in ThrottlerGuard requires `context.getClass().name` and `context.getHandler().name` — mock these for fallback tests
  - SDK rate-limit tests need `application.findUnique` in the PrismaService mock (SdkKeyGuard uses it) OR the ThrottlerGuard fires first as APP_GUARD before SdkKeyGuard

## Known Gaps (updated 2026-02-28)

- tenant-rate-limit.guard.spec.ts: NOW TESTED (12 tests)

## Auth Test Duplication Issue

- Auth controller tests exist in BOTH `apps/api/src/modules/auth/auth.controller.spec.ts` AND `apps/api/test/unit/controllers/auth.controller.spec.ts`
- The colocated version is more comprehensive (8 tests vs 3 tests)

## Gotchas

- agent.service.spec.ts uses `setTimeout` for async processing - fragile pattern
- E2E tests use `isE2EEnvironmentReady()` and `describe.skip` for conditional execution
- Integration tests require env vars: TEST_DATABASE_URL, TEST_REDIS_URL, TEST_S3_ENDPOINT
- Playwright tests require TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
- **jsdom doesn't define MediaError** - must mock it in setup.tsx for video player tests
- Video elements don't have accessible roles - use `container.querySelector('video')` instead of `getByRole`
- Setup files must be .tsx (not .ts) if they contain JSX for mocking components
- **AES-256-GCM encryption in tests**: Must use proper `encryptAES256GCM()` from @support-helper/shared to create valid encrypted configs. Base64 strings won't work - the auth tag must be appended correctly
- **Worker tests location**: Worker tests can be colocated in `__tests__/` subdirectories within `apps/worker/src/workers/`

## Test Suite Repair Patterns (2026-02-28)

- See `test-repair-patterns.md` for full patterns for fixing tests when source code evolves
- ESM @octokit/rest mock MUST go before imports (jest hoisting only works at start of file for ts-jest)
- Mutable arrays passed to mock fns — jest.mock.calls[0][0] reflects POST-mutation state
- TicketsService now injects 3 queues: github, deep-analysis, triage — provide all in TestingModule
- AgenticLoopService: ToolCapableProviderFactory.createForTenant() returns ToolCapableProvider with chat() method (not Anthropic messages.create)
- GithubInstallationService.removeInstallation: needs prisma.projectGithubConfig.deleteMany in mock
- Many services use projectGithubConfig.findFirst (not findUnique) after multi-repo refactor
- RepoContext now has: repoConfigId, role, fullName, isPrimary fields (not just owner/repo/defaultBranch)
- **Module mocking paths**: When mocking imports in worker tests, account for the `__tests__/` subdirectory in relative paths (e.g., `../../../../api/...` not `../../../api/...`)
- **Testing environment validation**: Must set ALL required env vars when testing optional var validation (e.g., API_PORT) - validation checks all required vars first
- **Environment variable testing**: Save and restore `process.env` using beforeEach/afterAll to isolate tests
- **Error handling in try-catch**: Some services (like modules/auth refresh) catch all errors and re-throw with generic message - test for the actual thrown message, not intermediate error details
- **Two auth services**: Root `apps/api/src/auth/auth.service.ts` vs nested `apps/api/src/modules/auth/auth.service.ts` - different responsibilities, separate test files
- **Zod DTO types**: FilterTicketsDto and similar DTOs with defaults still require all fields in TypeScript - use defaults in tests or cast enums with `as const`
- **Internal method calls**: When service methods call other methods (like `update` calling `findOne`), mocks must include all fields needed by both methods
- **TypeScript type assertions for partial mocks**: Use `as any as TargetType` for Express Request objects, `as any` for request objects that get properties added dynamically (e.g., `request.tenantId`)
- **Auth guard super.canActivate**: Guards extending AuthGuard must call super.canActivate() which triggers passport strategy validation - need to spy on parent class method for testing

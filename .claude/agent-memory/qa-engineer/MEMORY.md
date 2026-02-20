# QA Engineer Memory - Support Helper Platform

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
- VideoAnalysisWorker: FULLY TESTED (96.87% statements, 92.1% branches) - NOT a gap

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
- JwtStrategy (modules/auth) -> `apps/api/test/unit/auth/jwt.strategy.spec.ts` (7 tests)
- ApiKeyStrategy -> `apps/api/test/unit/auth/api-key.strategy.spec.ts` (7 tests)
- ApiKeyGuard -> `apps/api/test/unit/auth/api-key.guard.spec.ts` (5 tests)
- JwtAuthGuard (modules/auth) -> `apps/api/test/unit/auth/jwt-auth-module.guard.spec.ts` (6 tests)
- TenantGuard -> `apps/api/test/unit/auth/tenant.guard.spec.ts` (10 tests)
- Coverage: 66 tests total covering logging with correlation IDs, passport strategies, auth guards, tenant isolation
- Logger tests: log levels (info/error/warn/debug/verbose), correlation ID utilities, structured logging helpers (HTTP, DB, external services, security events), BetterStack/Logtail integration, message formatting (string/Error/object)
- Strategy tests: JWT validation with access/refresh token types, API key validation from x-api-key and x-sdk-key headers (backwards compat), user/application lookup
- Guard tests: @Public decorator handling, super.canActivate delegation, ExecutionContext mocking, tenant isolation enforcement
- Patterns: Mock winston with `jest.mock('winston')`, mock Express Request with `as any as Request` for partial objects, use `any` type for request objects that get mutated (e.g., `request.tenantId` assignment)
- Gotchas: Guards must check both handler and class for @Public metadata. TenantGuard stores `tenantId` in request object for downstream services. ApiKeyStrategy supports both x-api-key and x-sdk-key headers.
- All 66 tests passing

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
- **Module mocking paths**: When mocking imports in worker tests, account for the `__tests__/` subdirectory in relative paths (e.g., `../../../../api/...` not `../../../api/...`)
- **Testing environment validation**: Must set ALL required env vars when testing optional var validation (e.g., API_PORT) - validation checks all required vars first
- **Environment variable testing**: Save and restore `process.env` using beforeEach/afterAll to isolate tests
- **Error handling in try-catch**: Some services (like modules/auth refresh) catch all errors and re-throw with generic message - test for the actual thrown message, not intermediate error details
- **Two auth services**: Root `apps/api/src/auth/auth.service.ts` vs nested `apps/api/src/modules/auth/auth.service.ts` - different responsibilities, separate test files
- **Zod DTO types**: FilterTicketsDto and similar DTOs with defaults still require all fields in TypeScript - use defaults in tests or cast enums with `as const`
- **Internal method calls**: When service methods call other methods (like `update` calling `findOne`), mocks must include all fields needed by both methods
- **TypeScript type assertions for partial mocks**: Use `as any as TargetType` for Express Request objects, `as any` for request objects that get properties added dynamically (e.g., `request.tenantId`)
- **Auth guard super.canActivate**: Guards extending AuthGuard must call super.canActivate() which triggers passport strategy validation - need to spy on parent class method for testing

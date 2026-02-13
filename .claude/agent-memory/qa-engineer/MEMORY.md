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

## Known Gaps (as of 2026-02-08)
- ai/ai.service.ts has ZERO tests
- SDK widget element and state machine have ZERO tests
- 8 of 9 worker services are untested (only openai.service tested)
- 5 GitHub controllers untested
- No DTO validation tests
- tenant-rate-limit.guard has no tests (ThrottlerGuard subclass)

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

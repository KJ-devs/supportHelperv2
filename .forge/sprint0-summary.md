# Sprint 0 Security Fixes — Summary

**Date**: 2026-02-22
**Agent**: backend-dev
**Status**: ALL 7 ITEMS COMPLETE

---

## Items Status

### S-01: `env` file with secrets in .gitignore — FIXED
- **Change**: Added `/env` to `.gitignore` (root-level `env` file)
- **File**: `.gitignore`
- **Note**: The `env` file at repo root was not matched by `.env` (no dot prefix). Added `/env` explicitly.
- **Action required**: Rotate ALL secrets in the `env` file (OpenAI key, GitHub App private key, GitHub OAuth secret, JWT secrets) — they may have been exposed if committed previously.

### S-02: JWT tokens in SSO redirect URL — FIXED (pre-existing)
- **Change**: Changed `?token=` query params to `#token=` fragment in SSO callbacks
- **Files**: `apps/api/src/modules/auth/sso/sso-auth.controller.ts` (lines 121, 214)
- **Impact**: Tokens now in URL fragment, not sent in HTTP request logs or Referer headers.

### S-03: Webhook signature using rawBody — FIXED (pre-existing)
- **Changes**:
  - `apps/api/src/main.ts`: Added `rawBody: true` to NestFactory.create options
  - `apps/api/src/modules/github/services/github-webhooks.service.ts`: `processWebhook()` now accepts optional `rawBody?: Buffer`, uses it for HMAC verification instead of re-serialized JSON
  - `apps/api/src/modules/github/controllers/github-webhooks.controller.ts`: Passes `req.rawBody` to service
  - Tests updated accordingly

### S-04: GitHub App install state signing — FIXED (pre-existing)
- **Changes**:
  - `apps/api/src/modules/github/services/github-installation.service.ts`: Added `verifyInstallState()` method that uses `GithubOAuthService.verifyStateToken()`; `getInstallUrl()` now uses `generateStateToken()` instead of raw tenantId
  - `apps/api/src/modules/github/controllers/github-installation.controller.ts`: Controller now calls `verifyInstallState(state)` to extract tenantId cryptographically
- **Impact**: Prevents IDOR where attacker forges `state` param to associate install with arbitrary tenant.

### S-05: Setup endpoints unprotected after completion — FIXED
- **Changes**:
  - Guard `SetupNotCompletedGuard` already existed in `apps/api/src/modules/setup/guards/setup-not-completed.guard.ts`
  - Guard was registered in `SetupModule` providers
  - **Missing**: Guard was NOT applied to POST endpoints in controller
  - **Fixed**: Applied `@UseGuards(SetupNotCompletedGuard)` to all 6 POST endpoints in `apps/api/src/modules/setup/setup.controller.ts`:
    - `POST /setup/admin`
    - `POST /setup/validate-ai-key`
    - `POST /setup/smtp`
    - `POST /setup/smtp-test`
    - `POST /setup/progress`
    - `POST /setup/complete`
  - `GET /setup/status` remains open (needed by frontend to check if setup is needed)

### S-06: Rate limit on /auth/refresh — FIXED (pre-existing)
- **Change**: Added `@Throttle({ public: { limit: 10, ttl: 60000 } })` to `POST /auth/refresh`
- **File**: `apps/api/src/auth/auth.controller.ts` (line 44)

### S-07: Role check on DELETE webhooks cleanup + POST backup restore — FIXED (pre-existing)
- **Changes**:
  - `apps/api/src/modules/github/controllers/github-webhooks.controller.ts`: `DELETE /events/cleanup` now requires `@Roles('admin', 'owner')` + `RolesGuard`
  - `apps/api/src/modules/backup/backup.controller.ts`: `POST /restore` now requires `@Roles('admin', 'owner')` + `RolesGuard`

---

## Build & Test Verification

- **Build**: `pnpm --filter @support-helper/api build` → **PASS** (0 errors)
- **Sprint 0 tests**: All 72 related tests pass
  - `setup-not-completed.guard.spec.ts` — 3 tests pass
  - `github-webhooks.controller.spec.ts` — 5 tests pass
  - `github-installation.service.spec.ts` — tests pass
  - `github-webhooks.service.spec.ts` — tests pass
  - `backup.controller.spec.ts` — 8 tests pass
- **Pre-existing failures**: 45 test suites had failures before Sprint 0 work (missing modules: `api-key.guard`, `tenant.guard`, etc.). These are unrelated to Sprint 0.

---

## Files Modified

| File | Change |
|------|--------|
| `.gitignore` | Added `/env` |
| `apps/api/src/modules/setup/setup.controller.ts` | Applied `SetupNotCompletedGuard` to all 6 POST endpoints |

## Files Modified (pre-existing, not by this agent)

| File | Change |
|------|--------|
| `apps/api/src/main.ts` | `rawBody: true` |
| `apps/api/src/auth/auth.controller.ts` | Throttle on refresh |
| `apps/api/src/modules/auth/sso/sso-auth.controller.ts` | Fragment instead of query param |
| `apps/api/src/modules/backup/backup.controller.ts` | RolesGuard on restore |
| `apps/api/src/modules/github/controllers/github-installation.controller.ts` | State verification |
| `apps/api/src/modules/github/controllers/github-webhooks.controller.ts` | rawBody + RolesGuard |
| `apps/api/src/modules/github/services/github-installation.service.ts` | verifyInstallState() |
| `apps/api/src/modules/github/services/github-webhooks.service.ts` | rawBody in signature verification |
| `apps/api/src/modules/setup/setup.module.ts` | SetupNotCompletedGuard registered |
| `apps/api/src/modules/setup/guards/setup-not-completed.guard.ts` | Guard created (new file) |
| `apps/api/test/unit/modules/setup-not-completed.guard.spec.ts` | Tests for new guard (new file) |
| `apps/api/test/unit/controllers/github-webhooks.controller.spec.ts` | Updated for rawBody |
| `apps/api/test/unit/services/github-webhook.processor.spec.ts` | Added CacheService mock |

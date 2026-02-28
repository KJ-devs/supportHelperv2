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

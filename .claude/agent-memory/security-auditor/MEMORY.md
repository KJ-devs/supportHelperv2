# Security Auditor Memory

## Audit History
- 2026-02-08: Full security audit of auth + multi-tenant isolation completed

## Key Architecture Facts
- Two sets of guards exist: `apps/api/src/auth/guards/` and `apps/api/src/common/guards/`
- Global JWT guard is applied in main.ts (common/guards version)
- SDK routes use `@SdkAuth()` decorator + `SdkKeyGuard` (common/guards version)
- `@Public()` decorator bypasses JWT guard entirely
- TenantGuard exists but is NOT applied globally - controllers must use it explicitly
- Most controllers rely on `@CurrentTenant()` decorator which reads `request.user.tenantId`

## Critical Findings Found
1. SQL Injection in TenantGuard and TenantContextMiddleware via `$executeRawUnsafe` with string interpolation
2. Weak JWT secret in .env (`your-super-secret-jwt-key-change-in-production`)
3. Refresh token secret derived from JWT_SECRET with `_refresh` suffix (predictable)
4. Health endpoints expose infrastructure details publicly (Redis, DB, queues, metrics)
5. GitHub webhook test endpoint has no signature verification
6. Media download endpoint skips tenant verification (TODO comment)
7. GitHub OAuth state uses base64-encoded JSON (not signed) - can be forged
8. GithubConnection stores accessToken/refreshToken in plaintext
9. No helmet middleware for security headers
10. ApplicationsService.getStats ticket counts don't filter by tenantId

## Patterns to Watch
- `$executeRawUnsafe` usage = always check for string interpolation SQL injection
- `@Public()` routes = verify they should truly be unauthenticated
- Missing tenantId filtering = cross-tenant data leakage
- Plaintext token storage in database = credential theft risk

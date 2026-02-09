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
- Required env vars (non-optional): DATABASE_URL, JWT_SECRET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
- dist/ directory exists from previous builds
- Shared package (`@support-helper/shared`) is built and available

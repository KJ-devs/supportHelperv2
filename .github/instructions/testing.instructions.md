---
applyTo: '**/*.spec.ts,**/*.test.ts,**/test/**/*.ts'
---

# Testing Instructions

- **Jest** for `apps/api/` (config: `apps/api/jest.config.ts`)
- **Vitest** for `packages/` (config: `packages/*/vitest.config.ts`)
- **Playwright** for e2e (config: `apps/web/playwright.config.ts`)
- Mock `PrismaService` for unit tests
- Test multi-tenant isolation: cross-tenant access MUST fail
- Test both JWT and SDK key auth flows
- Test happy path + edge cases + error cases
- Name tests: `should [action] when [condition]`
- NEVER write timing-dependent flaky tests
- Seed database before e2e tests

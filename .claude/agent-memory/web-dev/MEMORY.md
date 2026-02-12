# Web Dev Agent Memory

## Project Structure

- App: `apps/web/` — Next.js 15 with App Router + Turbopack
- Package name: `@repo/web`
- Port: 3002
- Test framework: Vitest (48 tests)
- E2E: Playwright

## Tech Stack

- TanStack Query + Table + Form
- Zustand for state
- Radix UI primitives
- Lucide icons
- TipTap rich text editor
- Recharts for analytics
- TailwindCSS

## Key Commands

- Build: `pnpm --filter @repo/web build`
- Dev: `pnpm --filter @repo/web dev`
- Test: `pnpm --filter @repo/web test`
- E2E: `pnpm --filter @repo/web test:e2e`

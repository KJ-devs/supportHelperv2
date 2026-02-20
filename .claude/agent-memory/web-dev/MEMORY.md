# Web Dev Agent Memory

## Project Structure

- App: `apps/web/` — Next.js 15 with App Router + Turbopack
- Package name: `@repo/web`
- Port: 3002
- Test framework: Vitest (79 tests as of #111)
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
- Test: `pnpm --filter @repo/web test`  (script is `vitest run`, NOT `vitest --run`)
- E2E: `pnpm --filter @repo/web test:e2e`

## API Patterns

- API base URL: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`
- API has global prefix `/api` — all routes are `/api/tickets`, `/api/applications`, etc.
- `api.ts` client (`@/lib/api`) prepends API_URL, so endpoint paths must start with `/api/`
- Auth: JWT Bearer token from `localStorage.getItem('accessToken')`
- Token refresh is handled automatically by `api.ts` fetchApi wrapper

## Key Hooks

- `apps/web/src/hooks/use-new-ticket-form.ts` — createTicket, useApplications, useFileUpload, draft management
- `apps/web/src/hooks/use-tickets.ts` — ticketKeys, useTickets, useCreateTicket (basic)
- `apps/web/src/hooks/use-ticket-detail.ts` — useTicketDetail with mock fallback in dev

## API Endpoint Facts

- `GET /api/applications` returns an **array** directly, not `{ data, total }` — wrap it in the hook
- `POST /api/tickets` — payload: `{ title, description, applicationId, reproductionSteps, userContext }`
  - `type` and `severity` go into `userContext` (not top-level)
  - API type values differ from form: `feature` -> `feature_request`, `ui` -> `question`
- File upload flow (3 steps):
  1. `POST /api/media/presigned-url` -> `{ mediaId, uploadUrl, storageKey }`
  2. `PUT uploadUrl` with file body (direct to S3/MinIO, no auth header)
  3. `POST /api/media/complete` -> `{ mediaId, storageKey }`
- `POST /api/tickets/check-duplicate` endpoint does NOT exist — handle gracefully

## Form Patterns

- Forms use TanStack Form (`useForm`) + Zod validation via `zodValidator()`
- `form.Field` render-prop pattern with `field.state.value`, `field.handleChange`, `field.handleBlur`
- `form.Subscribe` to access `canSubmit`, `isSubmitting`
- `form.setFieldValue` for programmatic updates (e.g. auto-suggest severity)
- Multi-step form: `currentStep` state, step validation before advancing

## TanStack Query Conventions

- Query keys: `ticketKeys.all`, `.lists()`, `.list(filters)`, `.details()`, `.detail(id)`
- Optimistic updates: `cancelQueries` -> snapshot -> `setQueryData` -> return context
- Rollback in `onError` using context
- Invalidate in `onSuccess` with `invalidateQueries`
- `staleTime` set appropriately (applications: 5min, tickets: 30s)

## Test Patterns

- Mock `@/lib/api` with `vi.mock('@/lib/api', () => ({ api: { post, get, ... } }))`
- Mock `next/navigation` router with `useRouter: () => ({ push: vi.fn() })`
- Use `renderHook` + `waitFor` from `@testing-library/react`
- Wrap hooks in `QueryClientProvider` with `retry: false` options
- For `fetch`-based calls: mock `global.fetch = vi.fn()`
- `localStorage` is available in jsdom tests — clear in `beforeEach`/`afterEach`

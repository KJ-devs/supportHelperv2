# Dashboard Mock → Real API — Sprint 1 Summary

## Task #4 — Connect Dashboard mock pages to real API

### Changes Made

#### 1. Dashboard Home (`/dashboard`) — `apps/dashboard/app/dashboard/page.tsx`

**Before**: Hardcoded "0 nouveaux" and "1 active" stats.

**After**: Real API calls on component mount:
- `GET /api/analytics/overview?period=week` → displays `newTickets` count for the Tickets card
- `GET /api/applications` → displays total application count for the Applications card
- Shows `"..."` while loading, falls back to `0` on error

#### 2. Analytics Page (`/dashboard/analytics`) — `apps/dashboard/app/dashboard/analytics/page.tsx`

**Before**: Called `ticketsApi.getStats(period)` which hit `/api/tickets/stats` (no period filtering), and time range mapping was broken: both `90d` and `all` incorrectly mapped to `period=month`.

**After**:
- Switched to `analyticsApi.getOverview(period)` which hits `GET /api/analytics/overview`
- Fixed time range mapping:
  - `7d` → `period=week`
  - `30d` → `period=month`
  - `90d` → `period=month` (server groups by month, broader window)
  - `all` → no period param (server defaults to week granularity, shows all-time distribution data)
- Data now comes from the correct endpoint with proper typed response (`AnalyticsOverview`)
- Removed emoji characters from card titles per code style

#### 3. Settings — Team Tab (`/dashboard/settings`) — `apps/dashboard/app/dashboard/settings/page.tsx`

**Before**: Static fake data showing only the current user + "Aucun autre membre" placeholder.

**After**: Real API call to `GET /api/users` when the Team tab is activated:
- Shows all tenant members with name, email, and role
- Loading state while fetching
- Error state with message on failure
- Empty state if no members found
- Dark mode support added to all Team tab elements

### New API Client Method Added

**`apps/dashboard/lib/api/analytics.ts`** — added `getOverview()` method and `AnalyticsOverview` interface:
```ts
analyticsApi.getOverview(period?: 'day' | 'week' | 'month'): Promise<AnalyticsOverview>
// → GET /api/analytics/overview?period=...
```

### Build Result

`pnpm --filter @support-helper/dashboard build` — **0 errors**, 26 static pages generated successfully.

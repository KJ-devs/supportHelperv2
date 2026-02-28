# Phase C: Settings + GitHub + Integrations — Summary

## What was done

Replaced mock/static data with real API calls in all settings and GitHub components.

## Components updated

### GeneralSettings (`apps/web/src/components/settings/general-settings.tsx`)
- Fetches current tenant: `GET /api/tenants/current`
- On submit: `PATCH /api/tenants/current` with `{ name }` payload
- Shows success/error feedback; loading skeleton while tenant loads
- Form pre-populated from API response via `useEffect`

### NotificationSettings (`apps/web/src/components/settings/notification-settings.tsx`)
- Fetches user profile: `GET /api/users/:id` (id from localStorage)
- On save: `PATCH /api/users/notifications` with `{ emailOnNewTicket, emailOnStatusChange, emailOnComment, emailWeeklyReport }`
- Local state for toggles, explicit Save button with feedback

### TeamSettings (`apps/web/src/components/settings/team-settings.tsx`)
- Fetches all users: `GET /api/users` (returns all users in tenant)
- Shows avatar initials, role badge (owner/admin=default, agent/user=secondary)
- Invite Member button: TODO (no invite endpoint exists yet on API)

### IntegrationSettings (`apps/web/src/components/settings/integration-settings.tsx`)
- Fetches integrations: `GET /api/integrations`
- Toggle enable/disable: `PATCH /api/integrations/:id { enabled }`
- Shows type-based initials (GH, SL, JI, etc.) since icons aren't available
- Empty state when no integrations configured

### GitHubSyncStatus (`apps/web/src/components/github/github-sync-status.tsx`)
- Checks connection: `GET /api/github/oauth/status`
- If not connected: shows Connect button that calls `GET /api/github/oauth/authorize` → redirects to GitHub
- If connected: shows repo count and connection age

### GitHubRepositories (`apps/web/src/components/github/github-repositories.tsx`)
- Fetches: `GET /api/github/repos/connected`
- Shows repository name and linked application
- Empty state if no repos connected

### GitHubIssues (`apps/web/src/components/github/github-issues.tsx`)
- First checks GitHub connection status
- Then fetches recent tickets with `GET /api/tickets?limit=20` and reads their `githubIssues` relation
- Shows issue number, title, repository, status, link to ticket
- Note: No global "all linked issues" API endpoint exists — issues come embedded in ticket responses

## Notes / Limitations

- No global GitHub issues listing endpoint — queried via ticket relations
- Invite member flow is UI-only (button logs to console) — no backend invite endpoint yet
- Integrations display type initials instead of brand icons (no icon mapping in current codebase)

## Files modified

- `apps/web/src/components/settings/general-settings.tsx`
- `apps/web/src/components/settings/notification-settings.tsx`
- `apps/web/src/components/settings/team-settings.tsx`
- `apps/web/src/components/settings/integration-settings.tsx`
- `apps/web/src/components/github/github-sync-status.tsx`
- `apps/web/src/components/github/github-repositories.tsx`
- `apps/web/src/components/github/github-issues.tsx`

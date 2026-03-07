# Frontend Developer Memory

## Key Patterns

### VideoPlayer Component

- Always await `video.play()` - it returns a Promise that rejects with `NotSupportedError` if playback fails
- Use `<source>` element with `type` attribute instead of `src` directly on `<video>` for better codec detection
- Handle all MediaError codes: `MEDIA_ERR_ABORTED`, `MEDIA_ERR_NETWORK`, `MEDIA_ERR_DECODE`, `MEDIA_ERR_SRC_NOT_SUPPORTED`
- Clear error state on `onLoadStart` event to reset UI when loading new video
- Derive file extension from MIME type for downloads (webm/mp4/mov)
- **IMPORTANT**: `<video>` elements cannot send custom headers (like Authorization Bearer tokens)
- Use pre-signed URLs from the API endpoint `GET /api/media/:mediaId/url` instead of direct S3 URLs
- Fetch the pre-signed URL via authenticated API call first, then pass it to VideoPlayer

### Component Props

- When adding optional props to shared components, always check for existing usages in the codebase
- Use Grep tool to find component usages: `pattern: "ComponentName"` with glob `**/*.{tsx,ts}`

### Agent Chat Pattern (useAgentChatV2)

- Hook is in `apps/dashboard/hooks/useAgentChatV2.ts`
- Socket namespace: `/agent-v2`
- Add new WS listeners in the socket `useEffect` block
- `apiRequest` from `@/lib/api/client` is the correct way to call the API (handles auth token automatically)
- `createAgentSession` in `agent-v2.ts` accepts `(ticketId, preferredModel?, agentMode?)`
- All new hook state/functions must be added to both the `UseAgentChatV2Return` interface and the `return` object

### Selector Component Pattern (see ModelSelector, AgentModeSelector)

- Compact `<select>` with chevron overlay + a pill badge
- `disabled` prop triggers `opacity-50 cursor-not-allowed` + tooltip via `title` attribute
- Tailwind classes: `appearance-none text-xs pl-2 pr-6 py-1 rounded-lg border bg-gray-900 border-gray-700`

## i18n (next-intl) Patterns

- Infrastructure: `apps/dashboard/i18n/request.ts` (cookie-based locale, defaults to `fr`)
- Translation files: `apps/dashboard/messages/en.json` and `apps/dashboard/messages/fr.json` (MUST have identical keys)
- Client components: `useTranslations('namespace')` hook — requires `'use client'` directive
- Server components: `getTranslations('namespace')` async function
- Namespaces: `common`, `nav`, `auth.login/signup/forgotPassword/resetPassword`, `setup`, `setupAdmin`, `setupAi`, `setupEmail`, `setupGithub`, `setupSummary`, `dashboard`, `tickets`, `tickets.detail`, `bulkActions`, `pagination`, `agent`, `agent.metrics`, `agent.filters`, `agent.taskStatuses`, `applications`, `appCard`, `appModal`, `integrations`, `integrationCard`, `syncLogs`, `github`, `githubConnection`, `githubInstallations`, `repoCard`, `repoSelector`, `analytics`, `settings`, `search`, `connection`, `theme`, `language`, `export`, `video`, `sdk`, `page`, `agentMode`, `modelSelector`, `checkpoint`, `agentSection`, `liveActivity`, `ticketDetail`, `confirmModal`
- Locale-aware dates on client: `document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? 'fr'`
- Nested namespaces (e.g. `agent.metrics`): `useTranslations('agent.metrics')` — note the dot notation
- When using `t('key' as any)`, prefer adding the key to the JSON namespace directly instead
- Linter auto-reformats files after writes — re-read the file before any Edit if the file was recently written
- Dynamic key access pattern: `t(\`months.${month}\` as any)` for computed translation keys
- Parameterized translations: `t('sync.title', { name: syncTarget.name })`
- For `confirm()` dialogs, translate the string: `!confirm(t('deleteConfirm', { name: item.name }))`

## Tech Stack Notes

- Next.js 14 App Router in `apps/dashboard/`
- Client components need `'use client'` directive
- Shared UI components in `apps/dashboard/components/`
- Build command: `pnpm --filter @support-helper/dashboard build`

## Media Handling

- Media processing statuses: `pending`, `uploaded`, `processing`, `completed`, `failed`
- Backend uses MinIO/S3 for file storage with pre-signed URLs
- Media records have `storageKey` (S3 path) and `storageUrl` (direct S3 URL - not usable from browser due to auth)
- API endpoints:
  - `GET /api/media/:id` - Get media metadata with downloadUrl
  - `GET /api/media/:id/url` - Get pre-signed download URL (1 hour expiry)
  - `GET /api/media/download/:storageKey` - Redirect to pre-signed URL (requires JWT auth header)
- TypeScript types in `apps/dashboard/lib/types/ticket.ts` must match backend Prisma schema

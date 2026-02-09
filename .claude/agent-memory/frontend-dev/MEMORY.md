# Frontend Developer Memory

## Key Patterns

### VideoPlayer Component
- Always await `video.play()` - it returns a Promise that rejects with `NotSupportedError` if playback fails
- Use `<source>` element with `type` attribute instead of `src` directly on `<video>` for better codec detection
- Handle all MediaError codes: `MEDIA_ERR_ABORTED`, `MEDIA_ERR_NETWORK`, `MEDIA_ERR_DECODE`, `MEDIA_ERR_SRC_NOT_SUPPORTED`
- Clear error state on `onLoadStart` event to reset UI when loading new video
- Derive file extension from MIME type for downloads (webm/mp4/mov)

### Component Props
- When adding optional props to shared components, always check for existing usages in the codebase
- Use Grep tool to find component usages: `pattern: "ComponentName"` with glob `**/*.{tsx,ts}`

## Tech Stack Notes
- Next.js 14 App Router in `apps/dashboard/`
- Client components need `'use client'` directive
- Shared UI components in `apps/dashboard/components/`
- Build command: `pnpm --filter @support-helper/dashboard build`

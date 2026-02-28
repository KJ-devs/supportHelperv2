# SDK-Dev Agent Memory

## Project Structure

- SDK Location: `packages/sdk-web/`
- Build configs: `vite.config.ts` (npm) + `vite.config.cdn.ts` (CDN IIFE)
- Main exports: `src/index.ts` (SupportHelper class)
- Widget entry: `src/widget/index.ts` (Web Component)
- React wrapper: `src/react/index.ts`
- Vue wrapper: `src/vue/index.ts`

## Critical CDN Build

The CDN build is SEPARATE and CRITICAL:
- Command: `pnpm --filter @support-helper/sdk-web build:cdn`
- Output: `dist/cdn/sdk.iife.js`
- Without this file, the widget CANNOT render in CDN mode
- Entry point: `src/widget/index.ts` (not `src/index.ts`)

## TypeScript Strict Mode Patterns

### Window Global Type Safety
Never use `(window as any)`. Instead:
```typescript
// Bad
(window as any).SupportHelper = sdk;

// Good
(window as Window & { SupportHelper?: SupportHelper }).SupportHelper = sdk;
```

### DOMException Error Handling
```typescript
// Bad
if ((error as any).name === 'NotAllowedError') { ... }

// Good
if (error instanceof DOMException && error.name === 'NotAllowedError') { ... }
```

### ErrorEvent Handling
```typescript
// Bad
const msg = (event as any).error?.message || 'Unknown error';

// Good
const mediaErrorEvent = event as ErrorEvent;
const errorMessage = mediaErrorEvent.error?.message || mediaErrorEvent.message || 'Unknown error';
```

## Build Validation Checklist

1. `pnpm --filter @support-helper/sdk-web build` → ESM/CJS for npm
2. `pnpm --filter @support-helper/sdk-web build:cdn` → IIFE for CDN
3. Verify `dist/cdn/sdk.iife.js` exists (40KB minified)
4. `pnpm --filter @support-helper/sdk-web lint` → No warnings
5. `pnpm --filter @support-helper/sdk-web type-check` → No errors

## Web Component Architecture

- Custom element: `<support-helper>`
- Shadow DOM for style isolation
- State machine: idle → open → recording → preview → editing → submitting → analyzing → success/error
- Event delegation pattern (single root listener)
- Auto-registers on import

## API Surface

### Main Class Export
- `SupportHelper` - Main SDK class
- `SupportHelper.initialize()` - Static factory with button binding

### Widget Export
- `init()` - Programmatic widget initialization
- `SupportHelperElement` - Custom element class
- Auto-registration on import

### Wrappers
- React: `SupportHelperWidget` component + `useSupportHelper` hook
- Vue: `SupportHelperWidget` component + `useSupportHelper` composable

## Dependencies

- `@support-helper/shared` - workspace:* (shared types)
- Peer deps: react, vue (optional)
- Dev: vite, vite-plugin-dts, terser, vitest

## Offline Queue (US #211)

- Location: `src/offline-queue.ts` — IndexedDB-backed queue, no external deps
- `getOfflineQueue()` in `widget-api.ts` — lazy singleton, called once per page load
- `_setOfflineQueueForTesting(queue)` — test escape hatch to inject mock queue
- `submitReport()` returns `ReportResponse | null` — null means queued offline
- New widget events: `sh:queued`, `sh:queue-flushed`, `sh:queue-error`
- Limits: 50 entries, 500 MB total
- Backoff: 1s → 2s → 4s → … → 60s max, discard after 10 attempts

### TypeScript overload pattern for typed event emitter
When implementing overloaded `on(event, listener)` with a union implementation:
```typescript
// Overload signatures narrow the types
on(event: 'foo', listener: (d: FooDetail) => void): void;
on(event: 'bar', listener: (d: BarDetail) => void): void;
// Implementation accepts union
on(event: EventType, listener: ((d: FooDetail) => void) | ((d: BarDetail) => void)): void {
  this.listeners.get(event)!.push(
    listener as (d: FooDetail | BarDetail) => void
  );
}
```
The same cast pattern applies to `off()`. Use a single private `emit()` (no overloads needed).

## AI Polling (US #213)

- `pollTicketStatus()` in `widget-api.ts` — polls `GET /api/sdk/tickets/:id` every 5s up to 2min
- Returns `{ stop: () => void }` — always call stop() on widget close or disconnect
- `POLL_INTERVAL_MS = 5000`, `POLL_TIMEOUT_MS = 120_000` — exported constants
- `onResult(ticket)` callback returns `true` to stop polling (when `aiSummary` is non-null)
- `onTimeout()` callback fires after 2min with no result
- Network errors and non-2xx responses are silently swallowed — polling continues
- State flow after submit with ticket ID: `submitting` → `ANALYZE` → `analyzing` → `ANALYSIS_DONE/TIMEOUT` → `success`
- Offline queue path (null response): skip polling entirely, go directly `submitting` → `SUCCESS` → `success`
- `SupportHelperElement` fields: `pollStop`, `pollingTickTimer`, `pollingElapsed`, `pollingResult`, `pollingTimedOut`, `pollingTicketId`

## Vitest 1.x Fake Timer Pattern

`vi.runAllMicrotasksAsync` does NOT exist in vitest 1.x (added later). Use instead:
```typescript
// Flush microtasks after a void async fire-and-forget
async function flushPromises(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
// Then advance timers (also flushes microtasks in vitest 1.x)
await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
```

## Common Issues Fixed

1. **`any` types** - Replaced with proper type guards and intersection types
2. **Missing CDN build** - Separate vite config with IIFE format
3. **TypeScript strict mode** - Inherited from `tsconfig.base.json`
4. **Event listener memory leaks** - Flag to prevent duplicate attachment
5. **Overloaded event emitter TS errors** - See Offline Queue section above for the cast pattern
6. **`vi.runAllMicrotasksAsync` not a function** - Use `flushPromises()` helper with vitest 1.x

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
- State machine: idle → open → recording → preview → editing → submitting → success/error
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

## Common Issues Fixed

1. **`any` types** - Replaced with proper type guards and intersection types
2. **Missing CDN build** - Separate vite config with IIFE format
3. **TypeScript strict mode** - Inherited from `tsconfig.base.json`
4. **Event listener memory leaks** - Flag to prevent duplicate attachment

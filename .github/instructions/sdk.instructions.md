---
applyTo: 'packages/sdk-web/**/*.ts'
---

# SDK Development Instructions

- Main export: `SupportHelper` class as Web Component `<support-helper>`
- Build with Vite (library mode + CDN mode)
- Test with Vitest
- POST to `/api/sdk/tickets` with `x-sdk-key` header
- State machine: idle → open → recording → preview → editing → submitting → success
- Handle offline with IndexedDB queuing
- NEVER break backwards compatibility on the public API
- Keep bundle size minimal
- Use shared types from `packages/shared/`

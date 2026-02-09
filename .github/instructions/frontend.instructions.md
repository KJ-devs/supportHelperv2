---
applyTo: 'apps/dashboard/**/*.ts,apps/dashboard/**/*.tsx'
---

# Frontend Development Instructions

- Use Next.js 14 **App Router** (NOT Pages Router)
- Server Components by default; add `'use client'` only for interactive components
- Pages go in `app/[route]/page.tsx`, layouts in `app/[route]/layout.tsx`
- Fetch server data with TanStack Query hooks
- Local state with Zustand stores
- Style with TailwindCSS utility classes
- Always handle loading, error, and empty states
- API calls go to `localhost:3001` with JWT in `Authorization: Bearer <token>` header
- Responsive design is mandatory
- Import from `@/components/` and `@/lib/`

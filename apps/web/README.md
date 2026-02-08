# Support Helper Web App

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**Admin dashboard and marketing website for the Support Helper platform**

</div>

---

## ✨ Features

| Feature | Technology | Description |
|---------|------------|-------------|
| 🚀 App Router | Next.js 15.1 | File-based routing with Turbopack |
| ⚛️ Server Components | React 19 | Optimized SSR with streaming |
| 📝 Type Safety | TypeScript 5.7 | Full static type checking |
| 🎨 UI Components | Shadcn/ui + TailwindCSS 4 | Beautiful, accessible components |
| 📊 Server State | TanStack Query 5.62 | Caching, mutations, optimistic updates |
| 📋 Data Tables | TanStack Table 8.21 | Sorting, filtering, pagination |
| 📝 Forms | TanStack Form 0.37 | Validation, async submission |
| 🐻 UI State | Zustand 5.0 | Lightweight client state |
| ✅ Validation | Zod 3.24 | Runtime type validation |
| 🧪 Testing | Vitest + Playwright | Unit + E2E testing |

## 🚀 Quick Start

```bash
# From project root
pnpm install

# Run development server with Turbopack
pnpm --filter @support-helper/web dev

# Build for production
pnpm --filter @support-helper/web build

# Start production server
pnpm --filter @support-helper/web start

# Run tests
pnpm --filter @support-helper/web test
```

**Development URL**: http://localhost:3000

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes (grouped)
│   │   ├── login/         # Login page
│   │   └── register/      # Registration page
│   ├── (dashboard)/       # Dashboard routes (with shared layout)
│   │   ├── page.tsx       # Overview/analytics dashboard
│   │   ├── tickets/       # Ticket management
│   │   │   ├── page.tsx   # Ticket list
│   │   │   └── [id]/      # Ticket detail
│   │   ├── analytics/     # Analytics & reports
│   │   ├── settings/      # User & app settings
│   │   └── github/        # GitHub integration
│   ├── api/               # API route handlers (BFF)
│   ├── layout.tsx         # Root layout
│   ├── providers.tsx      # Client providers wrapper
│   └── globals.css        # Global styles + CSS variables
├── components/
│   ├── ui/                # Shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── auth/              # Auth-related components
│   ├── dashboard/         # Dashboard widgets
│   ├── tickets/           # Ticket components
│   │   ├── ticket-list.tsx
│   │   ├── ticket-card.tsx
│   │   └── ticket-detail.tsx
│   ├── analytics/         # Charts & analytics
│   ├── settings/          # Settings forms
│   ├── github/            # GitHub integration UI
│   └── layout/            # Layout components (sidebar, header)
├── hooks/                 # Custom React hooks
│   ├── use-tickets.ts     # TanStack Query hooks for tickets
│   ├── use-auth.ts        # Authentication hooks
│   └── use-media-query.ts # Responsive hooks
├── lib/                   # Utility functions
│   ├── api.ts             # API client
│   ├── utils.ts           # Helper functions
│   └── cn.ts              # Class name utility
├── stores/                # Zustand stores
│   ├── ui-store.ts        # UI state (sidebar, modals)
│   └── auth-store.ts      # Auth state
└── types/                 # TypeScript types
    ├── api.ts             # API response types
    └── ticket.ts          # Domain types
```

## ⚙️ Environment Variables

```env
# Required
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional - Analytics
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=

# Optional - Feature flags
NEXT_PUBLIC_ENABLE_GITHUB=true
```

## 🏗️ Development Patterns

### Adding New Pages

```tsx
// src/app/(dashboard)/my-feature/page.tsx
import { Metadata } from 'next';
import { MyFeatureClient } from '@/components/my-feature/my-feature-client';

export const metadata: Metadata = {
  title: 'My Feature | Support Helper',
  description: 'Description for SEO',
};

export default async function MyFeaturePage() {
  // Server-side data fetching (optional)
  const data = await fetch('...');
  
  return <MyFeatureClient initialData={data} />;
}
```

### Adding Components

```tsx
// src/components/my-feature/my-component.tsx
'use client'; // Only if needed for interactivity

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={cn('p-4 rounded-lg border', className)}>
      <h2>{title}</h2>
      <Button onClick={() => setIsOpen(!isOpen)}>Toggle</Button>
    </div>
  );
}
```

### State Management Patterns

#### Server State (TanStack Query)

```tsx
// src/hooks/use-tickets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTickets(filters?: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.tickets.list(filters),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.tickets.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
```

#### UI State (Zustand)

```tsx
// src/stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
```

### Form Handling (TanStack Form)

```tsx
// src/components/tickets/create-ticket-form.tsx
'use client';

import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';
import { useCreateTicket } from '@/hooks/use-tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ticketSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
});

export function CreateTicketForm() {
  const createTicket = useCreateTicket();
  
  const form = useForm({
    defaultValues: { title: '', description: '' },
    onSubmit: async ({ value }) => {
      await createTicket.mutateAsync(value);
    },
    validatorAdapter: zodValidator(),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="title"
        validators={{ onChange: ticketSchema.shape.title }}
      >
        {(field) => (
          <div>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Ticket title"
            />
            {field.state.meta.errors && (
              <p className="text-red-500 text-sm">{field.state.meta.errors}</p>
            )}
          </div>
        )}
      </form.Field>
      
      <Button type="submit" disabled={createTicket.isPending}>
        {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
      </Button>
    </form>
  );
}
```

## 🎨 Styling Guide

### CSS Variables (Theming)

```css
/* src/app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

### Using Tailwind + cn utility

```tsx
import { cn } from '@/lib/cn';

function Card({ className, variant = 'default', ...props }) {
  return (
    <div 
      className={cn(
        'rounded-lg border p-4',
        variant === 'success' && 'border-green-500 bg-green-50',
        variant === 'error' && 'border-red-500 bg-red-50',
        className
      )}
      {...props}
    />
  );
}
```

## 🧪 Testing

```bash
# Unit tests with Vitest
pnpm --filter @support-helper/web test
pnpm --filter @support-helper/web test:coverage

# E2E tests with Playwright
pnpm --filter @support-helper/web test:e2e
pnpm --filter @support-helper/web test:e2e:ui  # Interactive mode
```

### Unit Test Example

```tsx
// src/__tests__/components/ticket-card.test.tsx
import { render, screen } from '@testing-library/react';
import { TicketCard } from '@/components/tickets/ticket-card';

describe('TicketCard', () => {
  it('renders ticket title', () => {
    render(<TicketCard ticket={{ id: '1', title: 'Test Ticket' }} />);
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });
});
```

## 📦 Component Library (Shadcn/ui)

Add new components from Shadcn/ui:

```bash
# From apps/web directory
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
```

Available components: https://ui.shadcn.com/docs/components

## 🔗 Related Documentation

- [Root README](../../README.md) - Project overview
- [API Documentation](../../docs/API.md) - Backend API reference
- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Contributing](../../docs/CONTRIBUTING.md) - Development guidelines

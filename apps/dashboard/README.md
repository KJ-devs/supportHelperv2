# @support-helper/dashboard

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Admin Dashboard for Support Helper Platform**

Built with Next.js 14 App Router

</div>

---

## 🎯 Overview

The dashboard provides:
- 📋 Ticket management interface
- 🎥 Video playback with timeline sync
- 🤖 AI analysis visualization
- 👥 User and team management
- 🔗 GitHub integration settings
- 📊 Analytics and reporting

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 + TailwindCSS
- **State**: TanStack Query (server) + Zustand (client)
- **Auth**: next-auth with JWT
- **HTTP**: Axios

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Running API server at http://localhost:3001

### Development

```bash
# From project root
pnpm --filter @support-helper/dashboard dev
```

Dashboard will be available at http://localhost:3000

### Build

```bash
pnpm --filter @support-helper/dashboard build
pnpm --filter @support-helper/dashboard start
```

## Project Structure

```
app/
├── (auth)/                 # Auth routes (login, register)
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (dashboard)/            # Protected routes
│   ├── layout.tsx          # Dashboard layout with sidebar
│   ├── tickets/
│   │   ├── page.tsx        # Ticket list
│   │   └── [id]/
│   │       └── page.tsx    # Ticket detail
│   ├── applications/
│   │   └── page.tsx        # App management
│   ├── settings/
│   │   └── page.tsx        # Settings
│   └── analytics/
│       └── page.tsx        # Analytics dashboard
├── api/                    # API routes (next-auth)
│   └── auth/
│       └── [...nextauth]/
├── layout.tsx              # Root layout
└── page.tsx                # Landing/redirect

components/
├── ui/                     # Base UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   └── ...
├── tickets/                # Ticket components
│   ├── ticket-list.tsx
│   ├── ticket-card.tsx
│   ├── ticket-detail.tsx
│   └── ticket-filters.tsx
├── media/                  # Media components
│   ├── video-player.tsx
│   └── timeline.tsx
└── layout/                 # Layout components
    ├── sidebar.tsx
    ├── header.tsx
    └── nav.tsx

lib/
├── api/                    # API client
│   ├── client.ts
│   └── endpoints/
├── hooks/                  # Custom hooks
│   ├── use-tickets.ts
│   └── use-auth.ts
├── stores/                 # Zustand stores
│   └── ui-store.ts
└── utils/                  # Utilities

types/
└── index.ts                # TypeScript types
```

## App Router Patterns

### Server Components (Default)

```tsx
// app/(dashboard)/tickets/page.tsx
import { getTickets } from '@/lib/api/tickets';

export default async function TicketsPage() {
  const tickets = await getTickets();

  return (
    <div>
      <h1>Tickets</h1>
      <TicketList tickets={tickets} />
    </div>
  );
}
```

### Client Components

```tsx
// components/tickets/ticket-filters.tsx
'use client';

import { useState } from 'react';

export function TicketFilters({ onFilter }) {
  const [status, setStatus] = useState('all');

  return (
    <select value={status} onChange={(e) => {
      setStatus(e.target.value);
      onFilter({ status: e.target.value });
    }}>
      <option value="all">All</option>
      <option value="new">New</option>
      <option value="open">Open</option>
    </select>
  );
}
```

### Layouts

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

## State Management

### Server State (TanStack Query)

```tsx
// lib/hooks/use-tickets.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useTickets(filters = {}) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.get('/tickets', { params: filters }),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.post('/tickets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/tickets/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
```

### Client State (Zustand)

```tsx
// lib/stores/ui-store.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  selectedTicketId: string | null;
  setSelectedTicket: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  selectedTicketId: null,
  setSelectedTicket: (id) => set({ selectedTicketId: id }),
}));

// Usage
function Component() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  // ...
}
```

## API Integration

### API Client Setup

```tsx
// lib/api/client.ts
import axios from 'axios';
import { getSession } from 'next-auth/react';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Data Fetching Patterns

```tsx
// Server-side fetch (Server Component)
async function getTickets() {
  const res = await fetch(`${process.env.API_URL}/tickets`, {
    headers: {
      Authorization: `Bearer ${await getServerSession()}`,
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });
  return res.json();
}

// Client-side with TanStack Query
function TicketList() {
  const { data, isLoading, error } = useTickets();

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return <List items={data} />;
}
```

## Component Patterns

### Base UI Components

```tsx
// components/ui/button.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-md font-medium transition-colors',
          {
            'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
            'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
            'hover:bg-gray-100': variant === 'ghost',
            'px-2 py-1 text-sm': size === 'sm',
            'px-4 py-2': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
```

### Feature Components

```tsx
// components/tickets/ticket-card.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{ticket.title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {ticket.description?.slice(0, 100)}...
          </p>
        </div>
        <Badge variant={ticket.severity}>
          {ticket.severity}
        </Badge>
      </div>
      <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
        <span>{ticket.status}</span>
        <span>{formatDate(ticket.createdAt)}</span>
      </div>
    </Card>
  );
}
```

## TailwindCSS

### Configuration

```js
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
};
```

### Utility Function

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Lint code |
| `pnpm type-check` | TypeScript check |

## Best Practices

### Performance

1. Use Server Components by default
2. Add `'use client'` only when needed
3. Use React.lazy for code splitting
4. Optimize images with next/image
5. Use proper cache headers

### Accessibility

1. Use semantic HTML
2. Add ARIA labels
3. Ensure keyboard navigation
4. Test with screen readers
5. Maintain color contrast

### Code Organization

1. Keep components small and focused
2. Use custom hooks for logic
3. Separate UI and business logic
4. Use TypeScript strictly
5. Follow naming conventions

## 🔗 Related Documentation

- [Root README](../../README.md) - Project overview
- [API Reference](../../docs/API.md) - Backend API documentation
- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Contributing](../../docs/CONTRIBUTING.md) - Development guidelines

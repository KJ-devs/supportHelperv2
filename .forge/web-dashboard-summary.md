# Phase B: Dashboard Widgets — Summary

## What was done

Replaced mock data in all three dashboard widget components with real API calls.

## Components updated

### OverviewCards (`apps/web/src/components/dashboard/overview-cards.tsx`)
- Calls `GET /api/analytics/overview?period=month`
- Shows: Total Tickets, Open Tickets (from `ticketsByStatus`), Avg. Resolution Time, Resolution Rate
- Added loading skeletons

### RecentTickets (`apps/web/src/components/dashboard/recent-tickets.tsx`)
- Calls `GET /api/tickets?limit=5&sortBy=createdAt&sortOrder=desc` via `api.get()`
- Shows ticket title, severity badge, status badge, relative time
- Added loading skeletons and empty state

### TicketTrends (`apps/web/src/components/dashboard/ticket-trends.tsx`)
- Calls `GET /api/analytics/trends?period=day&days=7`
- Displays new tickets per day over last 7 days as a line chart
- Added loading skeleton (bar stubs)

## Notes

- RecentTickets uses `api.get()` directly (with Bearer auth) instead of the old unauthenticated `fetch` in `use-tickets-advanced.ts`
- The tickets API uses `limit` parameter (not `pageSize`)
- Ticket severity colors: critical=destructive, high=warning, medium=default, low=secondary

## Files modified

- `apps/web/src/components/dashboard/overview-cards.tsx`
- `apps/web/src/components/dashboard/recent-tickets.tsx`
- `apps/web/src/components/dashboard/ticket-trends.tsx`

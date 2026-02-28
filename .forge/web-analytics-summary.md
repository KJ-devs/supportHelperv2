# Phase A: Analytics Page — Summary

## What was done

Replaced all mock data generators in `apps/web/src/hooks/use-analytics.ts` with real API calls using the `api` client from `@/lib/api`.

## API endpoints used

- `GET /api/analytics/overview?period={day|week|month}` — metrics, ticketsByType, ticketsBySeverity
- `GET /api/analytics/trends?period={...}&days={n}` — ticketsPerDay, resolutionTrend, aiConfidence scaffold
- `GET /api/analytics/applications` — topApplications
- `GET /api/applications` — applications list for filter selector

## Notes / Limitations

- The API's `overview` endpoint returns `ticketsByType` with `{ type, _count }` shape — mapped to frontend's `{ type, count, color }`.
- The API's `ticketsBySeverity` returns `{ severity, _count }` — mapped similarly with hardcoded colors.
- `resolutionTrend`: The API does not expose daily average resolution time — using trends data as scaffold with placeholder avgTime.
- `aiConfidence`: Not tracked in the backend yet — displays trend count but `avgConfidence: 0`. Will be real data once backend tracks AI confidence per ticket.
- `totalTicketsChange`, `avgResolutionTimeChange`, etc.: Backend doesn't provide period-over-period comparison — set to `0` for now.
- `activeUsers`: Mapped to `resolvedTickets` from overview as an approximation (no user activity tracking).

## Files modified

- `apps/web/src/hooks/use-analytics.ts` — replaced all mock generators with `api.get()` calls

# Analytics Backend — Hardcoded Metrics Replaced

**Date**: 2026-02-22
**Agent**: backend-dev
**Status**: COMPLETE

---

## Changes Made

**File**: `apps/api/src/modules/analytics/analytics.service.ts`

### 1. avgFirstResponseTime (was hardcoded `2.5` hours)

**Query**: `ticket.findMany` with nested `ticketMessages` relation filtered to staff response types.

```ts
const tickets = await this.prisma.ticket.findMany({
  where: { tenantId },
  select: {
    createdAt: true,
    ticketMessages: {
      where: {
        type: { in: ['agent', 'diagnosis', 'action_plan', 'pr_status'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
      select: { createdAt: true },
    },
  },
});
```

- Computes `firstStaffMessage.createdAt - ticket.createdAt` for each ticket
- Returns average in hours (1 decimal place)
- Returns `null` when no staff responses exist (instead of fake `2.5`)

### 2. reopenRate (was hardcoded `5.2` percent)

**Query**: `ticketEvent.groupBy` on `ticket_reopened` events + `ticket.count` for resolved/closed.

```ts
const [reopenedCount, resolvedCount] = await Promise.all([
  this.prisma.ticketEvent.groupBy({
    by: ['ticketId'],
    where: { tenantId, eventType: 'ticket_reopened' },
  }).then(rows => rows.length),
  this.prisma.ticket.count({
    where: { tenantId, status: { in: ['resolved', 'closed'] } },
  }),
]);

const denominator = resolvedCount + reopenedCount;
if (denominator === 0) return null;
return Math.round((reopenedCount / denominator) * 1000) / 10; // 1 decimal %
```

- Counts distinct tickets with at least one `ticket_reopened` event (event type emitted by `ticket-reopen.controller.ts`)
- Denominator: resolved/closed + reopened (tickets that were ever resolved)
- Returns `null` when denominator = 0 (instead of fake `5.2`)

### 3. customerSatisfaction (was hardcoded `4.2` out of 5)

**Returns `null`** — `ClassificationFeedback` stores ML training corrections (`field`, `originalValue`, `correctedValue`), not satisfaction ratings. No CSAT model exists in the current schema.

Frontend should display "N/A" for this metric. Comment in code documents where to update when a satisfaction/rating model is added.

---

## Return Type Changes

`getPerformanceMetrics()` now returns:

| Field | Before | After |
|-------|--------|-------|
| `firstResponseTime` | `number` (always 2.5) | `number \| null` |
| `resolutionRate` | `number` | `number` (unchanged) |
| `reopenRate` | `number` (always 5.2) | `number \| null` |
| `customerSatisfaction` | `number` (always 4.2) | `null` (no schema support) |

---

## Tests

**File**: `apps/api/test/unit/services/analytics.service.spec.ts`

- Added `ticketEvent: { groupBy: jest.fn() }` to PrismaService mock
- Replaced 3 old `getPerformanceMetrics` tests with 7 new targeted tests:
  - Returns real query results with null for missing data
  - Calculates avg first response time correctly (2h example)
  - Returns null firstResponseTime when no staff responses
  - Calculates correct resolution rate (75%)
  - Returns 0 resolution rate when no tickets
  - Calculates reopen rate correctly (16.7% example)
  - Returns null reopenRate when no resolved tickets
  - Returns null customerSatisfaction always

**Result**: 21 tests pass (was 16)

---

## Build

`pnpm --filter @support-helper/api build` → **PASS** (0 errors)

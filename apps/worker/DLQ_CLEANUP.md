# Dead Letter Queue Cleanup

Automatic cleanup and archival system for failed BullMQ jobs.

## Overview

The DLQ cleanup system prevents the dead letter queue from growing indefinitely by:

1. **Archiving** old DLQ entries to database (default: 30 days retention)
2. **Removing** archived entries from Redis DLQ
3. **Deleting** very old archived entries (default: 90 days retention)

## Architecture

### Components

- **DlqCleanupService** (`services/dlq-cleanup.service.ts`) - Core cleanup logic
- **DlqCleanupWorker** (`workers/dlq-cleanup.worker.ts`) - BullMQ processor
- **DlqCleanupSchedulerService** (`services/dlq-cleanup-scheduler.service.ts`) - Cron scheduler
- **DeadLetterWorker** (`workers/dead-letter.worker.ts`) - Archives failed jobs immediately
- **ArchivedDeadLetterJob** (Prisma model) - Database table for archived jobs

### Data Flow

```
Job fails (max retries)
  → Dead Letter Queue (Redis)
  → DeadLetterWorker processes immediately
    → Archives to ArchivedDeadLetterJob table

DlqCleanupWorker runs daily (2 AM UTC)
  → Archive jobs older than DLQ_RETENTION_DAYS (30d)
  → Remove archived jobs from Redis DLQ
  → Delete archived jobs older than DLQ_ARCHIVE_RETENTION_DAYS (90d)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DLQ_CLEANUP_ENABLED` | `true` | Enable/disable automatic cleanup |
| `DLQ_CLEANUP_CRON` | `0 2 * * *` | Cron schedule (2 AM UTC daily) |
| `DLQ_RETENTION_DAYS` | `30` | Days to keep jobs in Redis DLQ |
| `DLQ_ARCHIVE_RETENTION_DAYS` | `90` | Days to keep archived jobs in database |

### Example Configuration

```env
# Disable automatic cleanup
DLQ_CLEANUP_ENABLED=false

# Run cleanup every 6 hours
DLQ_CLEANUP_CRON="0 */6 * * *"

# Keep jobs in DLQ for 14 days
DLQ_RETENTION_DAYS=14

# Keep archived jobs for 180 days (6 months)
DLQ_ARCHIVE_RETENTION_DAYS=180
```

## Database Schema

```sql
CREATE TABLE "archived_dead_letter_jobs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenant_id" UUID,  -- nullable for system-level jobs
    "queue_name" VARCHAR(100) NOT NULL,
    "job_id" VARCHAR(255) NOT NULL,
    "job_name" VARCHAR(255),
    "job_data" JSONB NOT NULL,
    "failed_reason" TEXT,
    "stack_trace" TEXT[],
    "attempts_made" INTEGER NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,  -- when DLQ processed it
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "ticket_id" UUID,  -- extracted from job_data
    "application_id" UUID
);

-- Indexes for efficient queries
CREATE INDEX ON "archived_dead_letter_jobs" ("tenant_id", "archived_at" DESC);
CREATE INDEX ON "archived_dead_letter_jobs" ("queue_name", "archived_at" DESC);
CREATE INDEX ON "archived_dead_letter_jobs" ("ticket_id");
CREATE INDEX ON "archived_dead_letter_jobs" ("archived_at");
```

## Usage

### Automatic Cleanup

Cleanup runs automatically based on the cron schedule (default: daily at 2 AM UTC).

### Manual Cleanup

Trigger cleanup manually via code:

```typescript
import { DlqCleanupSchedulerService } from './services/dlq-cleanup-scheduler.service';

// In a controller or service
await this.dlqCleanupScheduler.triggerManualCleanup();
```

### Get DLQ Metrics

```typescript
import { DlqCleanupService } from './services/dlq-cleanup.service';

const metrics = await this.dlqCleanupService.getMetrics();

console.log({
  dlqSize: metrics.dlqSize,              // Current DLQ size
  archiveSize: metrics.archiveSize,      // Archived jobs count
  oldestDlqJob: metrics.oldestDlqJob,    // Oldest job in DLQ
  oldestArchivedJob: metrics.oldestArchivedJob,
  retentionDays: metrics.retentionDays,
  archiveRetentionDays: metrics.archiveRetentionDays,
});
```

## Monitoring

### Logs

The cleanup worker logs:
- When cleanup starts/completes
- Number of jobs archived
- Number of jobs removed from DLQ
- Number of archived jobs deleted
- Current DLQ and archive sizes

Example log output:

```
[DlqCleanupService] DLQ cleanup completed in 2341ms:
  archived=15, deletedFromDlq=15, deletedFromArchive=3,
  dlqSize=42, archiveSize=125
```

### Cleanup Result

Each cleanup job returns:

```typescript
{
  success: true,
  archived: 15,           // Jobs moved to archive table
  deletedFromDlq: 15,     // Jobs removed from Redis
  deletedFromArchive: 3,  // Old archived jobs deleted
  dlqSize: 42,            // Current Redis DLQ size
  archiveSize: 125,       // Current archive table size
  duration: 2341          // Processing time (ms)
}
```

## Querying Archived Jobs

### Find failed jobs for a tenant

```typescript
const archivedJobs = await prisma.archivedDeadLetterJob.findMany({
  where: { tenantId: 'tenant-uuid' },
  orderBy: { archivedAt: 'desc' },
  take: 100,
});
```

### Find failed jobs for a ticket

```typescript
const ticketFailures = await prisma.archivedDeadLetterJob.findMany({
  where: { ticketId: 'ticket-uuid' },
  orderBy: { processedAt: 'asc' },
});
```

### Find failures by queue

```typescript
const queueFailures = await prisma.archivedDeadLetterJob.findMany({
  where: { queueName: 'video-analysis' },
  orderBy: { archivedAt: 'desc' },
});
```

## Future Enhancements

- [ ] Manual retry from archived jobs (requires queue injection)
- [ ] Dashboard UI for browsing DLQ/archive
- [ ] Alerting integration (email/Slack) for critical failures
- [ ] Analytics on failure patterns by queue/tenant
- [ ] Export archived jobs to S3 for long-term storage
- [ ] Automatic replay of transient failures (network errors)

## Testing

```bash
# Run DLQ cleanup service tests
pnpm --filter @support-helper/worker test dlq-cleanup.service.spec.ts

# Run DLQ cleanup worker tests
pnpm --filter @support-helper/worker test dlq-cleanup.worker.spec.ts
```

## Migration

To apply the database migration:

```bash
cd apps/api
pnpm db:migrate
```

Or in production:

```bash
cd apps/api
npx prisma migrate deploy
```

## Troubleshooting

### Cleanup not running

1. Check `DLQ_CLEANUP_ENABLED` is `true`
2. Verify cron expression is valid
3. Check worker logs for errors
4. Ensure Redis connection is healthy

### Archive table growing too large

1. Reduce `DLQ_ARCHIVE_RETENTION_DAYS`
2. Trigger manual cleanup: `triggerManualCleanup()`
3. Archive old data to S3 before deletion

### Jobs not being archived

1. Check DeadLetterWorker is running
2. Verify Prisma client is generated
3. Check database permissions
4. Review worker error logs

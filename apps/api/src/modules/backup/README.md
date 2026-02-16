# Backup & Restore Module (US-11.1)

## Overview
This module provides database and media backup/restore functionality for the Support Helper Platform. It uses BullMQ for asynchronous job processing in the worker service.

## Architecture

### API Module (`apps/api/src/modules/backup/`)
- **BackupController** - REST API endpoints for backup operations
- **BackupService** - Service layer for enqueuing jobs and managing backups
- **DTOs** - Request validation using class-validator

### Worker (`apps/worker/src/workers/backup.worker.ts`)
- **BackupWorker** - BullMQ processor for backup/restore operations
- Handles two job types: `create-backup` and `restore-backup`

## API Endpoints

All endpoints require JWT authentication (`JwtAuthGuard`).

### POST `/api/system/backup`
Trigger a manual backup.

**Request Body:**
```json
{
  "includeMedia": true,
  "label": "Pre-migration backup"
}
```

**Response:**
```json
{
  "jobId": "123456"
}
```

### GET `/api/system/backup`
List all available backups.

**Response:**
```json
[
  {
    "filename": "backup_20260216_143000_manual.tar.gz",
    "size": 1048576,
    "date": "2026-02-16T14:30:00.000Z",
    "type": "manual",
    "label": "Pre-migration backup"
  }
]
```

### GET `/api/system/backup/status/:jobId`
Get status of a backup or restore job.

**Response:**
```json
{
  "jobId": "123456",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "filename": "backup_20260216_143000_manual.tar.gz",
    "size": 1048576,
    "duration": 5000
  }
}
```

### POST `/api/system/backup/restore`
Restore from a backup file.

**Request Body:**
```json
{
  "filename": "backup_20260216_143000_manual.tar.gz",
  "skipMedia": false
}
```

**Response:**
```json
{
  "jobId": "123457"
}
```

## Backup Process

1. **Database Dump** - Uses `pg_dump` to create SQL dump
2. **Media Backup** (optional) - Placeholder for S3/MinIO sync (TODO)
3. **Archive Creation** - Creates tar.gz archive using `tar` command
4. **Storage** - Saves to `BACKUP_PATH` directory

## Restore Process

1. **Extract Archive** - Extracts tar.gz using `tar` command
2. **Database Restore** - Uses `psql` to restore SQL dump
3. **Media Restore** (optional) - Placeholder for S3/MinIO sync (TODO)

## Backup Filename Format

```
backup_YYYYMMDD_HHmmss_{manual|scheduled}.tar.gz
```

Example: `backup_20260216_143000_manual.tar.gz`

## Configuration

### Environment Variables
- `BACKUP_PATH` - Directory for backup storage (default: `/backups`)
- `DATABASE_URL` - PostgreSQL connection string

### Queue Configuration
- Queue name: `backup`
- Concurrency: 1 (only one backup/restore at a time)
- Retries: 3 attempts with exponential backoff
- Backoff delays: 5s, 10s, 20s

## License Feature

The `backup_restore` feature is available on **Pro** and **Enterprise** plans. However, basic backup functionality is intentionally left available on **Free** plans for disaster recovery purposes (controllers don't enforce feature gate, but it's registered in license types for future use).

## TODO / Future Enhancements

1. **Media Backup/Restore** - Implement S3/MinIO object sync
   - Option 1: Use S3Service to list and download/upload all objects
   - Option 2: Use MinIO `mc mirror` command

2. **Scheduled Backups** - Add cron job support for automatic backups

3. **Retention Policies** - Implement automatic cleanup of old backups

4. **Encryption** - Add encryption for backup archives

5. **Incremental Backups** - Support incremental database backups

6. **Notifications** - Send email notifications on backup failure

7. **Backup Verification** - Add integrity checks and test restores

## System Requirements

### Linux/Unix
- `pg_dump` and `psql` commands (PostgreSQL client tools)
- `tar` command (GNU tar)

### Windows
- PostgreSQL client tools in PATH
- GNU tar (from Git Bash, WSL, or Cygwin)

## Security Considerations

- Backup files contain sensitive data - ensure `BACKUP_PATH` has proper permissions
- Consider encrypting backups at rest
- Restore operations overwrite existing data - require admin confirmation in UI
- Database connection string may contain credentials - avoid logging

## Testing

Unit tests for BackupService and BackupController should be added in:
- `apps/api/test/unit/modules/backup.service.spec.ts`
- `apps/api/test/unit/modules/backup.controller.spec.ts`

Integration tests for BackupWorker should be added in:
- `apps/worker/test/integration/backup.worker.spec.ts`

# Database Backup System

Automated PostgreSQL backup system with S3 storage, retention policies, and Slack notifications.

## Overview

The Support Helper platform uses a comprehensive database backup strategy:

- Automated daily backups at 2 AM UTC via GitHub Actions
- S3 storage with AES256 encryption and STANDARD_IA storage class
- Retention policy: 7 daily + 4 weekly + 12 monthly backups
- Slack notifications for backup success/failure
- Automated cleanup of old backups

## Components

### 1. Backup Script (scripts/backup-database.sh)

Creates compressed PostgreSQL backups and uploads to S3.

Usage:
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
export BACKUP_BUCKET="your-backup-bucket"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

./scripts/backup-database.sh
```

Exit codes: 0=Success, 1=Missing env var, 2=pg_dump failed, 3=S3 upload failed

### 2. Retention Script (scripts/cleanup-old-backups.sh)

Implements backup retention policy and cleans up old backups.

Retention: 7 daily + 4 weekly (Sundays) + 12 monthly (1st of month)

### 3. GitHub Actions Workflow (.github/workflows/database-backup.yml)

Automated daily backup at 2 AM UTC. Manual trigger available.

### 4. Restore Runbook (docs/runbooks/database-restore.md)

Comprehensive step-by-step guide for database restore operations.

## Setup Instructions

### Local Setup

1. Configure .env.local:
```bash
BACKUP_BUCKET=support-helper-backups
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

2. Test backup:
```bash
chmod +x scripts/backup-database.sh scripts/cleanup-old-backups.sh
./scripts/backup-database.sh
```

### GitHub Actions Setup

Configure GitHub Secrets:
- BACKUP_BUCKET
- PRODUCTION_DATABASE_URL (or individual POSTGRES_* vars)
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION (optional, defaults to us-east-1)
- SLACK_WEBHOOK_URL (optional)

## Backup Format

Filename: support-helper-db-backup-YYYYMMDD_HHMMSS.sql.gz

Format: Plain SQL, gzip compressed, AES256 encrypted in S3

## Recovery

Quick restore:
```bash
aws s3 ls s3://support-helper-backups/ --region us-east-1
BACKUP_FILE="support-helper-db-backup-20260213_020000.sql.gz"
aws s3 cp "s3://support-helper-backups/${BACKUP_FILE}" ./ --region us-east-1
gunzip -c ${BACKUP_FILE} | psql -h localhost -U support -d support_helper
```

Production restore: See docs/runbooks/database-restore.md

## Monitoring

Backups send Slack notifications on success/failure.
Monitor workflow runs in GitHub Actions > Database Backup.

## Costs

Estimated ~$0.07/month for 30 backups @ 150MB each (STANDARD_IA storage).

## Related Documentation

- Database Restore Runbook: docs/runbooks/database-restore.md
- Backup Script: scripts/backup-database.sh
- Retention Script: scripts/cleanup-old-backups.sh
- GitHub Workflow: .github/workflows/database-backup.yml

---

Last Updated: 2026-02-13
Maintainer: DevOps Team

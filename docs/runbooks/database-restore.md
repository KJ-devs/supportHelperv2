# Database Restore Runbook

This runbook provides step-by-step procedures for restoring the Support Helper PostgreSQL database from S3 backups.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backup Location](#backup-location)
- [List Available Backups](#list-available-backups)
- [Download Backup](#download-backup)
- [Verify Backup Integrity](#verify-backup-integrity)
- [Test Restore (Recommended)](#test-restore-recommended)
- [Production Restore](#production-restore)
- [Post-Restore Checklist](#post-restore-checklist)
- [Rollback Procedure](#rollback-procedure)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting a restore operation, ensure you have:

- [ ] AWS credentials with read access to the backup S3 bucket
- [ ] PostgreSQL client tools installed (psql, pg_restore)
- [ ] Sufficient disk space for downloaded backup (typically 1-10GB)
- [ ] Database connection details (host, port, username, password)
- [ ] Approval from stakeholders (for production restores)
- [ ] Maintenance window scheduled (production downtime required)

Required environment variables:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
export BACKUP_BUCKET="your-backup-bucket"
export DATABASE_URL="postgresql://user:password@host:port/database"
```

---

## Backup Location

Backups are stored in S3 with the following structure:

```
s3://${BACKUP_BUCKET}/
  support-helper-db-backup-20260213_020000.sql.gz
  support-helper-db-backup-20260212_020000.sql.gz
  support-helper-db-backup-20260211_020000.sql.gz
  ...
```

Naming convention: `support-helper-db-backup-YYYYMMDD_HHMMSS.sql.gz`

Retention policy:
- Daily: Last 7 days (all backups)
- Weekly: Last 4 Sundays
- Monthly: Last 12 first-of-month backups

---

## List Available Backups

List all available backups sorted by date:

```bash
aws s3 ls s3://${BACKUP_BUCKET}/ --region ${AWS_REGION} | grep "support-helper-db-backup-" | sort -r | head -n 20
```

To find a specific backup by date:

```bash
aws s3 ls s3://${BACKUP_BUCKET}/ --region ${AWS_REGION} | grep "support-helper-db-backup-20260210"
```

---

## Download Backup

Download the selected backup to a local directory:

```bash
# Set backup filename
BACKUP_FILE="support-helper-db-backup-20260213_020000.sql.gz"

# Download from S3
aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_FILE}" ./${BACKUP_FILE} --region ${AWS_REGION}

# Verify download
ls -lh ${BACKUP_FILE}
```

---

## Verify Backup Integrity

Verify the gzip archive is not corrupted:

```bash
# Test gzip integrity
gunzip -t ${BACKUP_FILE}

# View first 50 lines of SQL (without extracting)
gunzip -c ${BACKUP_FILE} | head -n 50
```

---

## Test Restore (Recommended)

ALWAYS test the restore on a test database first.

### Create Test Database

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "CREATE DATABASE support_helper_restore_test;"
```

### Restore to Test Database

```bash
gunzip -c ${BACKUP_FILE} | psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper_restore_test
```

### Verify Test Restore

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper_restore_test
```

Run verification queries:

```sql
SELECT 'tickets' AS table_name, COUNT(*) FROM tickets
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants;

SELECT id, "createdAt" FROM tickets ORDER BY "createdAt" DESC LIMIT 5;
```

### Clean Up Test Database

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "DROP DATABASE support_helper_restore_test;"
```

---

## Production Restore

WARNING: This procedure will OVERWRITE the production database.

### Step 1: Create Current Database Backup

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper --format=plain --no-owner --no-acl | gzip > support-helper-pre-restore-${TIMESTAMP}.sql.gz

aws s3 cp support-helper-pre-restore-${TIMESTAMP}.sql.gz s3://${BACKUP_BUCKET}/manual-backups/ --region ${AWS_REGION} --server-side-encryption AES256
```

### Step 2: Stop All Services

```bash
docker-compose stop api worker

# Terminate remaining connections
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'support_helper' AND pid <> pg_backend_pid();"
```

### Step 3: Drop and Recreate Database

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "DROP DATABASE support_helper;"
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "CREATE DATABASE support_helper;"
```

### Step 4: Restore from Backup

```bash
gunzip -c ${BACKUP_FILE} | psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper
```

### Step 5: Verify Restore

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper -c "SELECT COUNT(*) FROM tickets;"
```

### Step 6: Run Prisma Migrations (If Needed)

```bash
cd apps/api && pnpm db:migrate
```

### Step 7: Restart Services

```bash
docker-compose start api worker
```

---

## Post-Restore Checklist

- [ ] All services started successfully
- [ ] API health check passes: curl http://localhost:3001/api/health
- [ ] Dashboard loads without errors
- [ ] Users can log in
- [ ] Recent tickets are visible
- [ ] File uploads work
- [ ] Background jobs processing
- [ ] No database connection errors in logs

---

## Rollback Procedure

```bash
docker-compose stop api worker
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "DROP DATABASE support_helper;"
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "CREATE DATABASE support_helper;"

aws s3 cp "s3://${BACKUP_BUCKET}/manual-backups/${PREBACKUP_FILE}" ./ --region ${AWS_REGION}
gunzip -c ${PREBACKUP_FILE} | psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -d support_helper

docker-compose start api worker
```

---

## Troubleshooting

### Error: "database is being accessed by other users"

```bash
psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -p ${POSTGRES_PORT} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'support_helper' AND pid <> pg_backend_pid();"
```

### Error: "extension 'vector' is not available"

```bash
psql -h ${POSTGRES_HOST} -U postgres -p ${POSTGRES_PORT} -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Error: "gzip: invalid compressed data"

```bash
# Re-download backup
rm ${BACKUP_FILE}
aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_FILE}" ./${BACKUP_FILE} --region ${AWS_REGION}
gunzip -t ${BACKUP_FILE}
```

---

## Emergency Contacts

- DevOps Lead: devops@support-helper.com
- Database Admin: dba@support-helper.com
- Slack Channel: #incidents

---

Last Updated: 2026-02-13
Maintainer: DevOps Team

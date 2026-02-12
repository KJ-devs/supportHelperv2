# Database Restore Runbook

This runbook provides step-by-step instructions for restoring the Support Helper database from automated backups.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Backup Types and Locations](#backup-types-and-locations)
4. [Restore Procedures](#restore-procedures)
5. [Verification](#verification)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Support Helper platform maintains automated database backups with the following retention policy:

- **Daily backups:** Last 7 days
- **Weekly backups:** Last 4 weeks (created every Sunday)
- **Monthly backups:** Last 12 months (created on the 1st of each month)

All backups are stored as compressed PostgreSQL dumps (`.sql.gz`) in S3-compatible storage.

---

## Prerequisites

Before starting a restore operation, ensure you have:

1. **Access credentials:**
   - S3 backup access key and secret key
   - Database admin credentials
   - SSH access to the database server (if applicable)

2. **Required tools:**
   ```bash
   # On Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y postgresql-client-16 awscli gzip

   # On macOS
   brew install postgresql@16 awscli
   ```

3. **Environment variables:**
   ```bash
   export S3_BACKUP_ENDPOINT="https://your-s3-endpoint"
   export S3_BACKUP_ACCESS_KEY="your-access-key"
   export S3_BACKUP_SECRET_KEY="your-secret-key"
   export S3_BACKUP_BUCKET="your-backup-bucket"
   export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   ```

---

## Backup Types and Locations

Backups are organized in S3 by environment and type:

```
s3://bucket-name/
└── backups/
    ├── prod/
    │   ├── daily/
    │   │   ├── support_helper_prod_20260212_020000.sql.gz
    │   │   ├── support_helper_prod_20260211_020000.sql.gz
    │   │   └── ...
    │   ├── weekly/
    │   │   ├── support_helper_prod_20260209_020000.sql.gz  (Sunday)
    │   │   └── ...
    │   └── monthly/
    │       ├── support_helper_prod_20260201_020000.sql.gz  (1st of month)
    │       └── ...
    └── staging/
        ├── daily/
        ├── weekly/
        └── monthly/
```

### Listing Available Backups

```bash
# Configure AWS CLI for S3-compatible storage
export AWS_ACCESS_KEY_ID="$S3_BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_BACKUP_SECRET_KEY"

# List production daily backups
aws s3 ls s3://${S3_BACKUP_BUCKET}/backups/prod/daily/ \
  --endpoint-url "$S3_BACKUP_ENDPOINT" \
  --no-verify-ssl

# List production weekly backups
aws s3 ls s3://${S3_BACKUP_BUCKET}/backups/prod/weekly/ \
  --endpoint-url "$S3_BACKUP_ENDPOINT" \
  --no-verify-ssl

# List production monthly backups
aws s3 ls s3://${S3_BACKUP_BUCKET}/backups/prod/monthly/ \
  --endpoint-url "$S3_BACKUP_ENDPOINT" \
  --no-verify-ssl
```

---

## Restore Procedures

### Option 1: Quick Restore (Recommended for Development/Staging)

This method directly restores to an existing database, **dropping all existing data**.

```bash
#!/bin/bash
set -euo pipefail

# 1. Set environment variables
export S3_BACKUP_ENDPOINT="https://your-s3-endpoint"
export S3_BACKUP_ACCESS_KEY="your-access-key"
export S3_BACKUP_SECRET_KEY="your-secret-key"
export S3_BACKUP_BUCKET="your-backup-bucket"
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# 2. Choose backup file to restore
BACKUP_FILE="support_helper_prod_20260212_020000.sql.gz"
BACKUP_TYPE="daily"  # or "weekly" or "monthly"
ENVIRONMENT="prod"   # or "staging"

# 3. Download backup from S3
mkdir -p /tmp/db-restore
cd /tmp/db-restore

export AWS_ACCESS_KEY_ID="$S3_BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_BACKUP_SECRET_KEY"

aws s3 cp "s3://${S3_BACKUP_BUCKET}/backups/${ENVIRONMENT}/${BACKUP_TYPE}/${BACKUP_FILE}" . \
  --endpoint-url "$S3_BACKUP_ENDPOINT" \
  --no-verify-ssl

# 4. Decompress the backup
gunzip "${BACKUP_FILE}"
SQL_FILE="${BACKUP_FILE%.gz}"

# 5. Extract database credentials from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')

# 6. Create a pre-restore backup (IMPORTANT!)
echo "Creating pre-restore backup..."
export PGPASSWORD="$DB_PASS"
pg_dump --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$DB_NAME" --format=plain \
  --file="pre_restore_$(date +%Y%m%d_%H%M%S).sql"

# 7. Stop all application services
echo "IMPORTANT: Stop all API, Worker, and Dashboard services before continuing!"
read -p "Press Enter when services are stopped..."

# 8. Terminate existing connections
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();
EOF

# 9. Drop and recreate database
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF

# 10. Restore from backup
echo "Restoring database from backup..."
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$DB_NAME" --file="$SQL_FILE"

# 11. Verify restore
RECORD_COUNT=$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$DB_NAME" --tuples-only --command="SELECT COUNT(*) FROM \"Tenant\";")

echo "Restore complete! Tenant count: ${RECORD_COUNT}"

# 12. Cleanup
cd ..
rm -rf /tmp/db-restore

echo "Database restored successfully!"
echo "Remember to:"
echo "1. Run migrations: pnpm db:migrate"
echo "2. Restart application services"
echo "3. Verify application functionality"
```

### Option 2: Safe Restore (Recommended for Production)

This method restores to a new database first, allowing verification before switching.

```bash
#!/bin/bash
set -euo pipefail

# 1. Set environment variables (same as Option 1)
export S3_BACKUP_ENDPOINT="https://your-s3-endpoint"
export S3_BACKUP_ACCESS_KEY="your-access-key"
export S3_BACKUP_SECRET_KEY="your-secret-key"
export S3_BACKUP_BUCKET="your-backup-bucket"
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# 2. Download and decompress backup (same as Option 1, steps 2-4)
# ... (same steps as above)

# 3. Extract database credentials
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')

export PGPASSWORD="$DB_PASS"

# 4. Create restore database with a temporary name
RESTORE_DB="${DB_NAME}_restore_$(date +%Y%m%d_%H%M%S)"

echo "Creating temporary restore database: ${RESTORE_DB}"
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
CREATE DATABASE ${RESTORE_DB};
EOF

# 5. Restore to temporary database
echo "Restoring to temporary database..."
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$RESTORE_DB" --file="$SQL_FILE"

# 6. Verify restored data
echo "Verifying restored data..."
TENANT_COUNT=$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$RESTORE_DB" --tuples-only --command="SELECT COUNT(*) FROM \"Tenant\";")

TICKET_COUNT=$(psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$RESTORE_DB" --tuples-only --command="SELECT COUNT(*) FROM \"Ticket\";")

echo "Restored database stats:"
echo "  Tenants: ${TENANT_COUNT}"
echo "  Tickets: ${TICKET_COUNT}"

read -p "Does this look correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore aborted. Temporary database '${RESTORE_DB}' left for inspection."
    exit 1
fi

# 7. Stop all application services
echo "IMPORTANT: Stop all API, Worker, and Dashboard services before continuing!"
read -p "Press Enter when services are stopped..."

# 8. Rename databases (atomic switch)
OLD_DB="${DB_NAME}_old_$(date +%Y%m%d_%H%M%S)"

echo "Switching databases..."
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
-- Terminate connections to current database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();

-- Rename current database to backup name
ALTER DATABASE ${DB_NAME} RENAME TO ${OLD_DB};

-- Rename restored database to production name
ALTER DATABASE ${RESTORE_DB} RENAME TO ${DB_NAME};
EOF

echo "Database switch complete!"
echo "Old database saved as: ${OLD_DB}"
echo ""
echo "Next steps:"
echo "1. Run migrations: pnpm db:migrate"
echo "2. Restart application services"
echo "3. Verify application functionality"
echo "4. If everything works, drop old database:"
echo "   DROP DATABASE ${OLD_DB};"
```

---

## Verification

After restoring the database, perform these verification steps:

### 1. Database Connection

```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

### 2. Table Count

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';
```

Expected: ~20 tables

### 3. Record Counts

```sql
-- Check tenant count
SELECT COUNT(*) as tenant_count FROM "Tenant";

-- Check ticket count
SELECT COUNT(*) as ticket_count FROM "Ticket";

-- Check user count
SELECT COUNT(*) as user_count FROM "User";

-- Check most recent data
SELECT MAX(created_at) as last_ticket_date FROM "Ticket";
```

### 4. Prisma Schema Compatibility

```bash
# Generate Prisma client to verify schema compatibility
pnpm db:generate

# Run migrations to apply any pending changes
pnpm db:migrate
```

### 5. Application Health Check

```bash
# Start services
pnpm docker:up
pnpm dev

# Check API health endpoint
curl http://localhost:3001/api/health

# Check dashboard loads
open http://localhost:3000
```

---

## Rollback

If the restore fails or introduces issues, you can roll back using one of these methods:

### Method 1: Using Pre-Restore Backup (Option 1)

If you created a pre-restore backup (step 6 in Option 1):

```bash
export PGPASSWORD="$DB_PASS"

# Restore from pre-restore backup
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF

psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$DB_NAME" --file="pre_restore_*.sql"
```

### Method 2: Using Old Database (Option 2)

If you used the safe restore method (Option 2):

```bash
export PGPASSWORD="$DB_PASS"

# Switch back to old database
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
-- Terminate connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();

-- Drop failed restore
DROP DATABASE ${DB_NAME};

-- Rename old database back
ALTER DATABASE ${OLD_DB} RENAME TO ${DB_NAME};
EOF
```

---

## Troubleshooting

### Issue: "permission denied for database"

**Solution:** Ensure you're using a superuser or the database owner account.

```bash
# Grant necessary permissions
psql --host="$DB_HOST" --port="$DB_PORT" --username="postgres" \
  --dbname="postgres" <<EOF
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
EOF
```

### Issue: "database is being accessed by other users"

**Solution:** Terminate all active connections before restore.

```bash
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="postgres" <<EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();
EOF
```

### Issue: Extensions missing (uuid-ossp, vector, pg_trgm)

**Solution:** Create extensions after restoring the database.

```bash
psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
  --dbname="$DB_NAME" <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOF
```

### Issue: Backup file is corrupted

**Symptoms:**
- `gzip: invalid compressed data` error
- `psql: error: connection to server was lost` during restore

**Solution:**

1. Verify backup file integrity:
   ```bash
   gunzip -t backup_file.sql.gz
   ```

2. Download the backup again from S3:
   ```bash
   aws s3 cp "s3://..." backup_file.sql.gz \
     --endpoint-url "$S3_BACKUP_ENDPOINT" \
     --no-verify-ssl
   ```

3. If corruption persists, try an older backup:
   ```bash
   # List available backups
   aws s3 ls s3://${S3_BACKUP_BUCKET}/backups/prod/daily/ \
     --endpoint-url "$S3_BACKUP_ENDPOINT" \
     --no-verify-ssl
   ```

### Issue: Out of disk space during restore

**Solution:**

1. Check available disk space:
   ```bash
   df -h
   ```

2. Clean up old backups and temporary files:
   ```bash
   rm -rf /tmp/db-restore
   rm -f pre_restore_*.sql
   ```

3. If restoring to production, consider using a larger disk or mounting additional storage.

### Issue: Restore takes too long

**Symptoms:** Restore process hangs or takes hours

**Solutions:**

1. **Disable triggers during restore** (faster, but riskier):
   ```bash
   psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
     --dbname="$DB_NAME" <<EOF
   ALTER TABLE "Ticket" DISABLE TRIGGER ALL;
   -- Repeat for other tables
   EOF

   # After restore, re-enable triggers
   psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
     --dbname="$DB_NAME" <<EOF
   ALTER TABLE "Ticket" ENABLE TRIGGER ALL;
   EOF
   ```

2. **Use parallel restore** (if backup was created with `pg_dump -Fc`):
   ```bash
   pg_restore --jobs=4 --host="$DB_HOST" --port="$DB_PORT" \
     --username="$DB_USER" --dbname="$DB_NAME" backup.dump
   ```

3. **Tune PostgreSQL settings** for faster restore:
   ```sql
   -- Temporarily increase work_mem and maintenance_work_mem
   SET work_mem = '256MB';
   SET maintenance_work_mem = '512MB';
   ```

---

## Emergency Contacts

- **DevOps Team:** devops@support-helper.com
- **On-Call Engineer:** +1-XXX-XXX-XXXX
- **Slack Channel:** #ops-incidents

---

## Backup Automation Details

- **Backup Schedule:** Daily at 2 AM UTC
- **GitHub Workflow:** `.github/workflows/database-backup.yml`
- **Backup Script:** `scripts/backup-database.sh`
- **Monitoring:** Slack notifications on success/failure

For issues with automated backups, check the GitHub Actions workflow runs at:
https://github.com/your-org/support-helper/actions/workflows/database-backup.yml

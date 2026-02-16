# Backup and Restore Guide

This guide covers how to backup and restore your Support Helper Platform self-hosted installation.

## Table of Contents

- [Overview](#overview)
- [What's Included](#whats-included)
- [Manual Backup](#manual-backup)
- [Automated Backups](#automated-backups)
- [Restore from Backup](#restore-from-backup)
- [Backup Retention](#backup-retention)
- [Cloud Storage](#cloud-storage)
- [Troubleshooting](#troubleshooting)

## Overview

Support Helper Platform includes automated backup scripts that create compressed archives containing:

- **PostgreSQL database** - All application data (tickets, users, tenants, etc.)
- **MinIO media files** - Uploaded videos, screenshots, and exports
- **Backup metadata** - Timestamp, hostname, and restore instructions

Backups are stored as `.tar.gz` archives with automatic rotation based on your retention policy.

## What's Included

### Database Backup
- All PostgreSQL tables and data
- Schema, indexes, and constraints
- Uses `pg_dump` custom format (`.dump`)
- Compressed and optimized for fast restore

### Media Files (Optional)
- MinIO object storage data
- Videos, screenshots, and exports
- Complete directory structure
- Can be skipped with `--no-media` flag

### Metadata
- Backup timestamp and hostname
- Docker Compose version
- List of backed-up services
- Restore instructions

## Manual Backup

### Basic Backup

Create a full backup (database + media):

```bash
./scripts/backup.sh
```

Output:
```
Support Helper — Backup Script
================================
Backup path: ./backups
Retention: 7 days
Skip media: false

✓ Docker is running
✓ All required services are running
✓ Database backup complete: 45M
✓ MinIO backup complete: 1.2G
✓ Archive created: 380M

Backup Complete!
================================
Backup file: ./backups/backup_20260216_143022.tar.gz
Size: 380M
Location: /home/user/supportHelperv2/backups/backup_20260216_143022.tar.gz
```

### Backup Database Only

Skip media files to save space and time:

```bash
./scripts/backup.sh --no-media
```

### Custom Retention Period

Keep backups for 30 days instead of the default 7:

```bash
./scripts/backup.sh --retention 30
```

### Custom Backup Location

Set a custom backup directory using the `BACKUP_PATH` environment variable:

```bash
BACKUP_PATH=/mnt/backups ./scripts/backup.sh
```

Or export it for all backup operations:

```bash
export BACKUP_PATH=/mnt/backups
./scripts/backup.sh
```

### Verify Backup Contents

List contents of a backup archive:

```bash
tar -tzf ./backups/backup_20260216_143022.tar.gz
```

View backup metadata:

```bash
tar -xzf ./backups/backup_20260216_143022.tar.gz -O temp_*/metadata.txt
```

## Automated Backups

### Setup Cron Job

The `backup-cron.sh` wrapper script is designed for automated backups via cron.

1. Make the script executable:

```bash
chmod +x ./scripts/backup-cron.sh
```

2. Edit your crontab:

```bash
crontab -e
```

3. Add one of these entries:

**Daily at 2 AM:**
```cron
0 2 * * * /path/to/supportHelperv2/scripts/backup-cron.sh
```

**Every 6 hours:**
```cron
0 */6 * * * /path/to/supportHelperv2/scripts/backup-cron.sh
```

**Weekly on Sunday at 3 AM:**
```cron
0 3 * * 0 /path/to/supportHelperv2/scripts/backup-cron.sh
```

**Twice daily (2 AM and 2 PM):**
```cron
0 2,14 * * * /path/to/supportHelperv2/scripts/backup-cron.sh
```

### Configure Automated Backups

The cron script supports environment variables:

```bash
# In your shell profile (~/.bashrc, ~/.zshrc, etc.)
export BACKUP_PATH=/mnt/backups
export BACKUP_RETENTION_DAYS=30
export BACKUP_SKIP_MEDIA=false
export NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Or create a wrapper script:

```bash
#!/bin/bash
export BACKUP_PATH=/mnt/backups
export BACKUP_RETENTION_DAYS=30
export NOTIFICATION_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
/path/to/supportHelperv2/scripts/backup-cron.sh
```

### View Backup Logs

Logs are stored in `$BACKUP_PATH/logs/`:

```bash
# View today's log
cat ./backups/logs/backup-$(date +%Y%m%d).log

# View last 50 lines
tail -n 50 ./backups/logs/backup-$(date +%Y%m%d).log

# Follow live
tail -f ./backups/logs/backup-$(date +%Y%m%d).log
```

### Notification Webhooks

The cron script can send notifications to Slack, Discord, or any webhook service.

**Slack:**
1. Create an incoming webhook: https://api.slack.com/messaging/webhooks
2. Set `NOTIFICATION_WEBHOOK` to your webhook URL
3. You'll receive notifications on backup success/failure

**Discord:**
1. Create a webhook in your Discord server
2. Set `NOTIFICATION_WEBHOOK` to your webhook URL
3. Notifications will appear in the configured channel

**Custom webhook:**
The script sends a JSON payload:
```json
{
  "text": "Support Helper Backup SUCCESS",
  "message": "Backup completed successfully. File: backup_20260216_143022.tar.gz, Size: 380M"
}
```

## Restore from Backup

### Full Restore

Restore both database and media files:

```bash
./scripts/restore.sh ./backups/backup_20260216_143022.tar.gz
```

The script will:
1. Ask for confirmation (this overwrites current data)
2. Stop application services (API, Worker, Dashboard)
3. Restore the PostgreSQL database
4. Restore MinIO media files
5. Restart all services
6. Wait for health checks

### Restore Database Only

Skip media file restore:

```bash
./scripts/restore.sh ./backups/backup_20260216_143022.tar.gz --skip-media
```

### Safety Features

The restore script includes several safety features:

1. **Confirmation prompt** - Prevents accidental data loss
2. **Backup verification** - Checks archive integrity before proceeding
3. **Safety backup** - Creates a backup of current MinIO data before overwriting
4. **Service orchestration** - Keeps database running while restoring
5. **Health checks** - Verifies services are healthy after restore

### Manual Restore (Emergency)

If the script fails, you can restore manually:

**Restore database:**
```bash
# Extract backup
tar -xzf ./backups/backup_20260216_143022.tar.gz

# Stop application services
docker compose stop api worker dashboard

# Restore database
docker compose exec -T postgres pg_restore \
  -U support \
  -d support_helper \
  --clean \
  --if-exists \
  < temp_*/database.dump

# Restart services
docker compose up -d
```

**Restore MinIO:**
```bash
# Stop MinIO
docker compose stop minio

# Replace data directory
rm -rf ./data/minio
cp -r temp_*/minio ./data/minio

# Restart MinIO
docker compose up -d minio
```

## Backup Retention

### Automatic Cleanup

Backups older than the retention period are automatically deleted during each backup:

- Default retention: **7 days**
- Customize with `--retention N` flag
- Runs after successful backup creation

### Manual Cleanup

List old backups:

```bash
find ./backups -name "backup_*.tar.gz" -type f -mtime +7
```

Delete backups older than 30 days:

```bash
find ./backups -name "backup_*.tar.gz" -type f -mtime +30 -delete
```

### Space Management

Monitor backup directory size:

```bash
du -sh ./backups
du -h ./backups/backup_*.tar.gz
```

Calculate average backup size:

```bash
ls -lh ./backups/backup_*.tar.gz | awk '{sum+=$5; count++} END {print "Average:", sum/count}'
```

## Cloud Storage

### Sync to AWS S3

Automatically upload backups to S3 after creation:

```bash
# Install AWS CLI
sudo apt-get install awscli

# Configure credentials
aws configure

# Create sync script: ./scripts/backup-to-s3.sh
#!/bin/bash
set -euo pipefail

# Run backup
./scripts/backup.sh "$@"

# Get the latest backup file
LATEST_BACKUP=$(ls -t ./backups/backup_*.tar.gz | head -n 1)

# Upload to S3
aws s3 cp "$LATEST_BACKUP" s3://your-bucket/support-helper-backups/

echo "Backup uploaded to S3: s3://your-bucket/support-helper-backups/$(basename $LATEST_BACKUP)"
```

Make it executable and update your crontab:

```bash
chmod +x ./scripts/backup-to-s3.sh
```

```cron
0 2 * * * /path/to/supportHelperv2/scripts/backup-to-s3.sh
```

### Sync to Google Cloud Storage

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Authenticate
gcloud auth login

# Create sync script: ./scripts/backup-to-gcs.sh
#!/bin/bash
set -euo pipefail

./scripts/backup.sh "$@"

LATEST_BACKUP=$(ls -t ./backups/backup_*.tar.gz | head -n 1)

gsutil cp "$LATEST_BACKUP" gs://your-bucket/support-helper-backups/

echo "Backup uploaded to GCS: gs://your-bucket/support-helper-backups/$(basename $LATEST_BACKUP)"
```

### Sync to Azure Blob Storage

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Authenticate
az login

# Create sync script: ./scripts/backup-to-azure.sh
#!/bin/bash
set -euo pipefail

./scripts/backup.sh "$@"

LATEST_BACKUP=$(ls -t ./backups/backup_*.tar.gz | head -n 1)

az storage blob upload \
  --account-name yourstorageaccount \
  --container-name support-helper-backups \
  --file "$LATEST_BACKUP" \
  --name "$(basename $LATEST_BACKUP)"

echo "Backup uploaded to Azure: $(basename $LATEST_BACKUP)"
```

### Lifecycle Policies

Configure cloud storage lifecycle rules to automatically delete old backups:

**AWS S3:**
```json
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "support-helper-backups/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

**Google Cloud Storage:**
```bash
gsutil lifecycle set lifecycle.json gs://your-bucket
```

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["support-helper-backups/"]
        }
      }
    ]
  }
}
```

## Troubleshooting

### Backup Script Errors

**Docker not running:**
```
Error: Docker is not running
```
**Solution:** Start Docker Desktop or Docker daemon
```bash
sudo systemctl start docker
```

**PostgreSQL service not running:**
```
Error: PostgreSQL service is not running
```
**Solution:** Start services
```bash
docker compose up -d postgres
```

**Permission denied:**
```
Permission denied: ./backups
```
**Solution:** Create directory with proper permissions
```bash
mkdir -p ./backups
chmod 755 ./backups
```

### Restore Script Errors

**Invalid backup archive:**
```
Error: Invalid backup archive structure
```
**Solution:** Verify the backup file is not corrupted
```bash
tar -tzf ./backups/backup_20260216_143022.tar.gz
```

**Database restore errors:**
```
pg_restore: error: could not execute query: ERROR:  relation "..." does not exist
```
**Solution:** This is often normal (dropping non-existent objects). Check if the restore completed:
```bash
docker compose exec postgres psql -U support support_helper -c "\dt"
```

**MinIO restore failed:**
```
Error: Failed to restore MinIO data
```
**Solution:** Check disk space and permissions
```bash
df -h
ls -la ./data/
```

### Health Check Failures

**API not becoming healthy:**
```
Error: API did not become healthy after 60s
```
**Solution:** Check API logs
```bash
docker compose logs api
```

Common causes:
- Database connection issues (check `DATABASE_URL`)
- Missing environment variables
- Port conflicts (3001 already in use)
- Redis connection issues

**PostgreSQL not healthy:**
```
PostgreSQL did not become healthy after 60s
```
**Solution:** Check PostgreSQL logs
```bash
docker compose logs postgres
```

Common causes:
- Corrupted data directory
- Insufficient disk space
- Port conflicts (5432 already in use)
- Invalid `POSTGRES_PASSWORD`

### Disk Space Issues

Check available disk space:

```bash
df -h
```

Estimate backup size before creating:

```bash
# Database size
docker compose exec postgres psql -U support support_helper -c "SELECT pg_size_pretty(pg_database_size('support_helper'));"

# MinIO size
du -sh ./data/minio
```

Free up space by deleting old backups:

```bash
# Delete backups older than 7 days
find ./backups -name "backup_*.tar.gz" -type f -mtime +7 -delete

# Delete backup logs older than 30 days
find ./backups/logs -name "backup-*.log" -type f -mtime +30 -delete
```

### Cron Job Not Running

Verify cron service is running:

```bash
sudo systemctl status cron
```

Check cron logs:

```bash
# Ubuntu/Debian
sudo tail -f /var/log/syslog | grep CRON

# CentOS/RHEL
sudo tail -f /var/log/cron
```

Test the cron script manually:

```bash
# Run with full path
/path/to/supportHelperv2/scripts/backup-cron.sh

# Check exit code
echo $?
```

Ensure proper permissions:

```bash
chmod +x ./scripts/backup-cron.sh
chmod +x ./scripts/backup.sh
```

### Webhook Notifications Not Working

Test webhook manually:

```bash
# Slack/Discord
curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test notification"}'
```

Check cron script has `curl` installed:

```bash
which curl
sudo apt-get install curl  # If missing
```

Verify webhook URL is correct:

```bash
echo $NOTIFICATION_WEBHOOK
```

## Best Practices

### Backup Strategy

1. **Frequency:** At least daily for production systems
2. **Retention:** Keep 7-30 days locally, longer in cloud storage
3. **Verification:** Periodically test restore on a separate system
4. **Monitoring:** Set up alerts for backup failures
5. **Off-site:** Always maintain cloud copies (3-2-1 rule)

### 3-2-1 Backup Rule

- **3** copies of your data
- **2** different media types (local + cloud)
- **1** copy off-site

Example implementation:
- 1 copy: Production database (live)
- 2 copies: Local backup directory (`./backups`)
- 3 copies: S3/GCS/Azure cloud storage

### Testing Restores

Regularly test your backups:

```bash
# 1. Create a test backup
./scripts/backup.sh

# 2. Set up a test environment (separate docker-compose)
# 3. Restore to test environment
./scripts/restore.sh ./backups/backup_YYYYMMDD_HHmmss.tar.gz

# 4. Verify data integrity
docker compose exec postgres psql -U support support_helper
```

### Security

- Store backups in encrypted cloud storage
- Restrict access to backup files (chmod 600)
- Rotate backup encryption keys regularly
- Never commit backup files to version control
- Use IAM roles instead of access keys for cloud uploads

### Monitoring

Monitor backup health:

```bash
# Check last backup time
ls -lt ./backups/backup_*.tar.gz | head -n 1

# Alert if no backup in last 25 hours
LAST_BACKUP=$(find ./backups -name "backup_*.tar.gz" -type f -mtime -1)
if [ -z "$LAST_BACKUP" ]; then
  echo "WARNING: No backup created in the last 24 hours"
fi
```

Integrate with monitoring systems (Prometheus, Grafana, etc.):
- Export backup metrics (size, duration, success/failure)
- Set up alerts for backup failures
- Track backup growth over time

## Related Documentation

- [Installation Guide](./installation.md) - Initial setup and configuration
- [Updating Guide](./updating.md) - How to update your installation
- [README](./README.md) - Overview and quick links

#!/bin/bash
set -euo pipefail

# Database Backup Script
# Usage: ./scripts/backup-database.sh [prod|staging]

ENVIRONMENT="${1:-prod}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/db-backups"
BACKUP_FILE="support_helper_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"

# Check required environment variables
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_BACKUP_ENDPOINT:?S3_BACKUP_ENDPOINT is required}"
: "${S3_BACKUP_ACCESS_KEY:?S3_BACKUP_ACCESS_KEY is required}"
: "${S3_BACKUP_SECRET_KEY:?S3_BACKUP_SECRET_KEY is required}"
: "${S3_BACKUP_BUCKET:?S3_BACKUP_BUCKET is required}"

# Extract database credentials
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')

echo "====================================="
echo "Database Backup: ${ENVIRONMENT}"
echo "Database: ${DB_NAME} at ${DB_HOST}:${DB_PORT}"
echo "Timestamp: ${TIMESTAMP}"
echo "====================================="

send_slack_notification() {
    [ -z "${SLACK_WEBHOOK_URL:-}" ] && return 0
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$1\"}" "$SLACK_WEBHOOK_URL" --silent --output /dev/null
}

cleanup_on_error() {
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    send_slack_notification "❌ Backup failed for ${ENVIRONMENT}: $1"
    exit 1
}

trap 'cleanup_on_error "Script error"' ERR

mkdir -p "$BACKUP_DIR"

# Step 1: Create database dump
echo "Creating database dump..."
export PGPASSWORD="$DB_PASS"
pg_dump --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
    --dbname="$DB_NAME" --format=plain --no-owner --no-acl \
    --file="${BACKUP_DIR}/${BACKUP_FILE%.gz}" || cleanup_on_error "pg_dump failed"

# Step 2: Compress
echo "Compressing backup..."
gzip -9 "${BACKUP_DIR}/${BACKUP_FILE%.gz}" || cleanup_on_error "Compression failed"

SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "Backup size: ${SIZE}"

# Step 3: Determine backup type
DAY_OF_WEEK=$(date +%u)
DAY_OF_MONTH=$(date +%d)

if [ "$DAY_OF_MONTH" == "01" ]; then
    BACKUP_TYPE="monthly"
elif [ "$DAY_OF_WEEK" == "7" ]; then
    BACKUP_TYPE="weekly"
else
    BACKUP_TYPE="daily"
fi

S3_PATH="s3://${S3_BACKUP_BUCKET}/backups/${ENVIRONMENT}/${BACKUP_TYPE}/${BACKUP_FILE}"
echo "Uploading to ${S3_PATH}..."

# Step 4: Upload to S3
export AWS_ACCESS_KEY_ID="$S3_BACKUP_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_BACKUP_SECRET_KEY"

if [ "$S3_BACKUP_ENDPOINT" != "https://s3.amazonaws.com" ]; then
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "$S3_PATH" \
        --endpoint-url "$S3_BACKUP_ENDPOINT" --no-verify-ssl || cleanup_on_error "S3 upload failed"
else
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "$S3_PATH" || cleanup_on_error "S3 upload failed"
fi

# Step 5: Cleanup old backups
cleanup_old() {
    local type=$1 days=$2
    local prefix="s3://${S3_BACKUP_BUCKET}/backups/${ENVIRONMENT}/${type}/"
    [ "$S3_BACKUP_ENDPOINT" != "https://s3.amazonaws.com" ] && EP="--endpoint-url $S3_BACKUP_ENDPOINT --no-verify-ssl" || EP=""
    aws s3 ls "$prefix" $EP | awk '{print $4}' | while read f; do
        [ -z "$f" ] && continue
        fdate=$(echo "$f" | grep -oP '\d{8}' | head -1)
        [ -z "$fdate" ] && continue
        age=$(( ($(date +%s) - $(date -d "$fdate" +%s 2>/dev/null || echo 0)) / 86400 ))
        [ "$age" -gt "$days" ] && aws s3 rm "${prefix}${f}" $EP
    done
}

cleanup_old "daily" 7
cleanup_old "weekly" 28
cleanup_old "monthly" 365

rm -f "$BACKUP_DIR/$BACKUP_FILE"
send_slack_notification "✅ Backup complete for ${ENVIRONMENT}: ${BACKUP_FILE} (${SIZE})"

echo "====================================="
echo "Backup completed: ${BACKUP_TYPE} (${SIZE})"
echo "====================================="

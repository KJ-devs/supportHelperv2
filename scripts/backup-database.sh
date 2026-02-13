#!/bin/bash
# Database Backup Script
set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Parse DATABASE_URL or use individual variables
if [ -n "${DATABASE_URL:-}" ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
else
  DB_USER="${POSTGRES_USER:-}"
  DB_PASSWORD="${POSTGRES_PASSWORD:-}"
  DB_HOST="${POSTGRES_HOST:-localhost}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  DB_NAME="${POSTGRES_DB:-}"
fi

BACKUP_BUCKET="${BACKUP_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="support-helper-db-backup-${TIMESTAMP}.sql.gz"
BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

validate_requirements() {
  local missing_vars=()
  [ -z "$DB_USER" ] && missing_vars+=("DB_USER/POSTGRES_USER")
  [ -z "$DB_PASSWORD" ] && missing_vars+=("DB_PASSWORD/POSTGRES_PASSWORD")
  [ -z "$DB_NAME" ] && missing_vars+=("DB_NAME/POSTGRES_DB")
  [ -z "$BACKUP_BUCKET" ] && missing_vars+=("BACKUP_BUCKET")
  [ -z "${AWS_ACCESS_KEY_ID:-}" ] && missing_vars+=("AWS_ACCESS_KEY_ID")
  [ -z "${AWS_SECRET_ACCESS_KEY:-}" ] && missing_vars+=("AWS_SECRET_ACCESS_KEY")
  
  if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Missing required environment variables: ${missing_vars[*]}"
    exit 1
  fi
  
  if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Install PostgreSQL client tools."
    exit 1
  fi
  
  if ! command -v aws &> /dev/null; then
    log_error "aws CLI not found. Install AWS CLI v2."
    exit 1
  fi
  
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    log_warn "SLACK_WEBHOOK_URL not set. Skipping Slack notifications."
  fi
}

send_slack_notification() {
  local status="$1"
  local message="$2"
  local color="$3"
  local details="${4:-}"
  
  [ -z "$SLACK_WEBHOOK_URL" ] && return 0
  
  local hostname="${HOSTNAME:-unknown}"
  local env="${NODE_ENV:-production}"
  local timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
  
  local payload="{\"attachments\":[{\"color\":\"${color}\",\"title\":\"Database Backup ${status}\",\"text\":\"${message}\",\"fields\":[{\"title\":\"Environment\",\"value\":\"${env}\",\"short\":true},{\"title\":\"Hostname\",\"value\":\"${hostname}\",\"short\":true},{\"title\":\"Database\",\"value\":\"${DB_NAME}\",\"short\":true},{\"title\":\"Timestamp\",\"value\":\"${timestamp}\",\"short\":true}],\"footer\":\"Support Helper Backup System\"}]}"
  
  curl -X POST -H 'Content-type: application/json' \
    --data "$payload" \
    "$SLACK_WEBHOOK_URL" \
    --silent --show-error || log_warn "Failed to send Slack notification"
}

create_backup() {
  log_info "Starting database backup..."
  log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
  log_info "Backup file: ${BACKUP_FILENAME}"
  
  export PGPASSWORD="$DB_PASSWORD"
  
  if pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    --verbose \
    2>&1 | gzip > "$BACKUP_PATH"; then
    
    local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "Backup created successfully: ${backup_size}"
    return 0
  else
    log_error "pg_dump failed"
    return 2
  fi
  
  unset PGPASSWORD
}

upload_to_s3() {
  log_info "Uploading to S3: s3://${BACKUP_BUCKET}/${BACKUP_FILENAME}"
  
  if aws s3 cp "$BACKUP_PATH" \
    "s3://${BACKUP_BUCKET}/${BACKUP_FILENAME}" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256 \
    --metadata "database=${DB_NAME},timestamp=${TIMESTAMP},hostname=${HOSTNAME:-unknown}"; then
    
    log_info "Upload successful"
    
    if aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_FILENAME}" --region "$AWS_REGION" > /dev/null; then
      local s3_size=$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_FILENAME}" --region "$AWS_REGION" | awk '{print $3}')
      log_info "S3 verification passed (${s3_size} bytes)"
      return 0
    else
      log_error "S3 verification failed: file not found after upload"
      return 3
    fi
  else
    log_error "S3 upload failed"
    return 3
  fi
}

cleanup() {
  if [ -f "$BACKUP_PATH" ]; then
    log_info "Cleaning up temporary files..."
    rm -f "$BACKUP_PATH"
  fi
}

main() {
  local exit_code=0
  local error_message=""
  
  log_info "=== Support Helper Database Backup ==="
  
  validate_requirements
  trap cleanup EXIT
  
  if ! create_backup; then
    exit_code=2
    error_message="Database dump failed. Check pg_dump logs."
    log_error "$error_message"
    send_slack_notification "Failed" "$error_message" "danger"
    exit $exit_code
  fi
  
  if [ ! -s "$BACKUP_PATH" ]; then
    exit_code=2
    error_message="Backup file is empty or does not exist"
    log_error "$error_message"
    send_slack_notification "Failed" "$error_message" "danger"
    exit $exit_code
  fi
  
  if ! upload_to_s3; then
    exit_code=3
    error_message="S3 upload failed. Backup file created but not uploaded."
    log_error "$error_message"
    send_slack_notification "Failed" "$error_message" "danger" "Local backup: ${BACKUP_PATH}"
    exit $exit_code
  fi
  
  local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
  local success_message="Backup completed successfully: ${BACKUP_FILENAME} (${backup_size})"
  log_info "$success_message"
  send_slack_notification "Success" "$success_message" "good" "S3: s3://${BACKUP_BUCKET}/${BACKUP_FILENAME}"
  
  log_info "=== Backup Complete ==="
  exit 0
}

main "$@"

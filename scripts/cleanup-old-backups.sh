#!/bin/bash
# Database Backup Retention Script
set -euo pipefail

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

BACKUP_BUCKET="${BACKUP_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_PREFIX="support-helper-db-backup-"

# Retention policy
DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=12

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
  if [ -z "$BACKUP_BUCKET" ]; then
    log_error "BACKUP_BUCKET environment variable is required"
    exit 1
  fi
  
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    log_error "AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are required"
    exit 1
  fi
  
  if ! command -v aws &> /dev/null; then
    log_error "aws CLI not found. Install AWS CLI v2."
    exit 1
  fi
}

list_backups() {
  log_info "Listing backups in s3://${BACKUP_BUCKET}/"
  
  aws s3 ls "s3://${BACKUP_BUCKET}/" \
    --region "$AWS_REGION" \
    --recursive | \
    grep "${BACKUP_PREFIX}" | \
    awk '{print $4}' | \
    sort -r
}

parse_backup_date() {
  local filename="$1"
  # Extract date from filename: support-helper-db-backup-YYYYMMDD_HHMMSS.sql.gz
  local date_part=$(echo "$filename" | sed -n "s/${BACKUP_PREFIX}\([0-9]\{8\}\)_[0-9]\{6\}\.sql\.gz/\1/p")
  echo "$date_part"
}

is_sunday() {
  local date_str="$1"
  # Convert YYYYMMDD to day of week (0=Sunday)
  local day_of_week=$(date -d "${date_str:0:4}-${date_str:4:2}-${date_str:6:2}" +%w 2>/dev/null || echo "7")
  [ "$day_of_week" == "0" ]
}

is_first_of_month() {
  local date_str="$1"
  # Check if day is 01
  [ "${date_str:6:2}" == "01" ]
}

days_old() {
  local date_str="$1"
  local backup_date="${date_str:0:4}-${date_str:4:2}-${date_str:6:2}"
  local current_date=$(date +%Y-%m-%d)
  
  # Calculate difference in days
  local diff_seconds=$(( $(date -d "$current_date" +%s) - $(date -d "$backup_date" +%s) ))
  local diff_days=$(( diff_seconds / 86400 ))
  echo "$diff_days"
}

weeks_old() {
  local days="$1"
  echo $(( days / 7 ))
}

months_old() {
  local date_str="$1"
  local backup_year=${date_str:0:4}
  local backup_month=${date_str:4:2}
  local current_year=$(date +%Y)
  local current_month=$(date +%m)
  
  echo $(( (current_year - backup_year) * 12 + (10#$current_month - 10#$backup_month) ))
}

should_keep_backup() {
  local filename="$1"
  local date_str=$(parse_backup_date "$filename")
  
  if [ -z "$date_str" ]; then
    log_warn "Cannot parse date from filename: $filename (keeping)"
    return 0
  fi
  
  local age_days=$(days_old "$date_str")
  local age_weeks=$(weeks_old "$age_days")
  local age_months=$(months_old "$date_str")
  
  # Keep if less than DAILY_RETENTION days old
  if [ "$age_days" -lt "$DAILY_RETENTION" ]; then
    log_info "Keep (daily): $filename (${age_days}d old)"
    return 0
  fi
  
  # Keep if Sunday and less than WEEKLY_RETENTION weeks old
  if is_sunday "$date_str" && [ "$age_weeks" -lt "$WEEKLY_RETENTION" ]; then
    log_info "Keep (weekly): $filename (${age_weeks}w old, Sunday)"
    return 0
  fi
  
  # Keep if 1st of month and less than MONTHLY_RETENTION months old
  if is_first_of_month "$date_str" && [ "$age_months" -lt "$MONTHLY_RETENTION" ]; then
    log_info "Keep (monthly): $filename (${age_months}mo old, 1st)"
    return 0
  fi
  
  # Delete
  log_warn "Delete: $filename (${age_days}d old)"
  return 1
}

delete_backup() {
  local filename="$1"
  
  log_info "Deleting s3://${BACKUP_BUCKET}/${filename}"
  
  if aws s3 rm "s3://${BACKUP_BUCKET}/${filename}" --region "$AWS_REGION"; then
    log_info "Deleted successfully"
    return 0
  else
    log_error "Failed to delete $filename"
    return 1
  fi
}

main() {
  log_info "=== Database Backup Retention Policy ==="
  log_info "Daily: Keep last ${DAILY_RETENTION} days"
  log_info "Weekly: Keep last ${WEEKLY_RETENTION} Sundays"
  log_info "Monthly: Keep last ${MONTHLY_RETENTION} 1st-of-month backups"
  echo ""
  
  validate_requirements
  
  local backups=$(list_backups)
  
  if [ -z "$backups" ]; then
    log_warn "No backups found in s3://${BACKUP_BUCKET}/"
    exit 0
  fi
  
  local total_count=0
  local kept_count=0
  local deleted_count=0
  local failed_count=0
  
  while IFS= read -r backup; do
    total_count=$((total_count + 1))
    
    if should_keep_backup "$backup"; then
      kept_count=$((kept_count + 1))
    else
      if delete_backup "$backup"; then
        deleted_count=$((deleted_count + 1))
      else
        failed_count=$((failed_count + 1))
      fi
    fi
  done <<< "$backups"
  
  echo ""
  log_info "=== Cleanup Summary ==="
  log_info "Total backups: $total_count"
  log_info "Kept: $kept_count"
  log_info "Deleted: $deleted_count"
  [ "$failed_count" -gt 0 ] && log_warn "Failed: $failed_count"
  log_info "=== Cleanup Complete ==="
  
  exit 0
}

main "$@"

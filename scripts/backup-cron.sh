#!/bin/bash
set -euo pipefail

# Support Helper — Automated Backup (Cron Wrapper)
# =================================================
# This script is designed to be run via cron for automated backups.
# It calls backup.sh and logs the output for monitoring.
#
# Example crontab entry (daily at 2 AM):
#   0 2 * * * /path/to/supportHelperv2/scripts/backup-cron.sh
#
# Example crontab entry (every 6 hours):
#   0 */6 * * * /path/to/supportHelperv2/scripts/backup-cron.sh
#
# Example crontab entry (weekly on Sunday at 3 AM):
#   0 3 * * 0 /path/to/supportHelperv2/scripts/backup-cron.sh

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_PATH="${BACKUP_PATH:-$PROJECT_ROOT/backups}"
LOG_DIR="$BACKUP_PATH/logs"
LOG_FILE="$LOG_DIR/backup-$(date +%Y%m%d).log"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
SKIP_MEDIA="${BACKUP_SKIP_MEDIA:-false}"

# Optional notification webhook (Slack, Discord, etc.)
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"

# Create log directory
mkdir -p "$LOG_DIR"

# Log function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Notification function
notify() {
  local status="$1"
  local message="$2"

  if [ -n "$NOTIFICATION_WEBHOOK" ]; then
    if command -v curl &> /dev/null; then
      # Generic JSON payload (works with most webhook services)
      curl -s -X POST "$NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Support Helper Backup $status\",\"message\":\"$message\"}" \
        > /dev/null 2>&1 || true
    fi
  fi
}

# Start backup
log "========================================="
log "Starting automated backup"
log "========================================="
log "Backup path: $BACKUP_PATH"
log "Retention: $RETENTION_DAYS days"
log "Skip media: $SKIP_MEDIA"

# Change to project root
cd "$PROJECT_ROOT"

# Build backup command
BACKUP_CMD="$SCRIPT_DIR/backup.sh --retention $RETENTION_DAYS"
if [ "$SKIP_MEDIA" = "true" ]; then
  BACKUP_CMD="$BACKUP_CMD --no-media"
fi

# Run backup and capture output
if output=$(BACKUP_PATH="$BACKUP_PATH" $BACKUP_CMD 2>&1); then
  log "Backup completed successfully"
  log "$output"

  # Extract backup filename from output
  BACKUP_FILE=$(echo "$output" | grep -oP 'Backup file: \K.*' || echo "unknown")
  SIZE=$(echo "$output" | grep -oP 'Size: \K.*' || echo "unknown")

  log "Backup file: $BACKUP_FILE"
  log "Size: $SIZE"

  # Send success notification
  notify "SUCCESS" "Backup completed successfully. File: $BACKUP_FILE, Size: $SIZE"

  exit 0
else
  log "ERROR: Backup failed"
  log "$output"

  # Send failure notification
  notify "FAILED" "Backup failed. Check logs at $LOG_FILE"

  exit 1
fi

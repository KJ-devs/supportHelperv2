#!/bin/bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default configuration
BACKUP_PATH="${BACKUP_PATH:-./backups}"
RETENTION_DAYS=7
SKIP_MEDIA=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-media)
      SKIP_MEDIA=true
      shift
      ;;
    --retention)
      RETENTION_DAYS="$2"
      shift 2
      ;;
    --help)
      echo "Support Helper — Backup Script"
      echo "Usage: ./scripts/backup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --no-media          Skip MinIO media backup"
      echo "  --retention N       Keep backups for N days (default: 7)"
      echo "  --help             Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  BACKUP_PATH        Backup directory (default: ./backups)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Support Helper — Backup Script${NC}"
echo "================================"
echo "Backup path: $BACKUP_PATH"
echo "Retention: $RETENTION_DAYS days"
echo "Skip media: $SKIP_MEDIA"
echo ""

# 1. Check Docker is running
echo -e "${YELLOW}Checking Docker status...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi
echo -e "${GREEN}Docker is running${NC}"

# 2. Check if services are running
echo -e "\n${YELLOW}Checking services...${NC}"
if ! docker compose ps postgres | grep -q "Up"; then
  echo -e "${RED}Error: PostgreSQL service is not running${NC}"
  echo "Start services with: docker compose up -d"
  exit 1
fi

if [ "$SKIP_MEDIA" = false ]; then
  if ! docker compose ps minio | grep -q "Up"; then
    echo -e "${RED}Error: MinIO service is not running${NC}"
    echo "Start services with: docker compose up -d"
    echo "Or use --no-media to skip media backup"
    exit 1
  fi
fi
echo -e "${GREEN}All required services are running${NC}"

# 3. Create backup directory
mkdir -p "$BACKUP_PATH"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR="$BACKUP_PATH/temp_$TIMESTAMP"
mkdir -p "$TEMP_DIR"

echo -e "\n${YELLOW}Creating backup: backup_${TIMESTAMP}.tar.gz${NC}"

# 4. Backup PostgreSQL database
echo -e "\n${YELLOW}Backing up PostgreSQL database...${NC}"
DB_FILE="$TEMP_DIR/database.dump"
docker compose exec -T postgres pg_dump -U support -Fc support_helper > "$DB_FILE" 2>/dev/null

if [ -f "$DB_FILE" ] && [ -s "$DB_FILE" ]; then
  DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
  echo -e "${GREEN}Database backup complete: $DB_SIZE${NC}"
else
  echo -e "${RED}Error: Database backup failed or is empty${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# 5. Backup MinIO data (if not skipped)
if [ "$SKIP_MEDIA" = false ]; then
  echo -e "\n${YELLOW}Backing up MinIO media files...${NC}"

  # Copy MinIO data directory
  MINIO_DIR="$TEMP_DIR/minio"
  mkdir -p "$MINIO_DIR"

  # Get the actual data directory path from Docker volume
  if [ -d "./data/minio" ]; then
    cp -r ./data/minio/* "$MINIO_DIR/" 2>/dev/null || true

    if [ -d "$MINIO_DIR" ] && [ "$(ls -A $MINIO_DIR)" ]; then
      MINIO_SIZE=$(du -sh "$MINIO_DIR" | cut -f1)
      echo -e "${GREEN}MinIO backup complete: $MINIO_SIZE${NC}"
    else
      echo -e "${YELLOW}Warning: MinIO directory is empty${NC}"
    fi
  else
    echo -e "${YELLOW}Warning: MinIO data directory not found at ./data/minio${NC}"
  fi
fi

# 6. Create metadata file
echo -e "\n${YELLOW}Creating backup metadata...${NC}"
cat > "$TEMP_DIR/metadata.txt" <<EOF
Support Helper Backup
=====================
Timestamp: $TIMESTAMP
Date: $(date '+%Y-%m-%d %H:%M:%S %Z')
Hostname: $(hostname)
Docker Compose Version: $(docker compose version --short 2>/dev/null || echo "unknown")
Database Included: Yes
Media Included: $([ "$SKIP_MEDIA" = false ] && echo "Yes" || echo "No")

Services Backed Up:
- PostgreSQL (support_helper database)
$([ "$SKIP_MEDIA" = false ] && echo "- MinIO (object storage)")

Restore Instructions:
See docs/self-hosted/backup-restore.md
Or run: ./scripts/restore.sh backup_${TIMESTAMP}.tar.gz
EOF

echo -e "${GREEN}Metadata created${NC}"

# 7. Create compressed archive
echo -e "\n${YELLOW}Creating compressed archive...${NC}"
BACKUP_FILE="$BACKUP_PATH/backup_${TIMESTAMP}.tar.gz"
tar -czf "$BACKUP_FILE" -C "$BACKUP_PATH" "temp_$TIMESTAMP"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}Archive created: $BACKUP_SIZE${NC}"
else
  echo -e "${RED}Error: Failed to create archive${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# 8. Cleanup temp directory
rm -rf "$TEMP_DIR"

# 9. Clean old backups (retention policy)
echo -e "\n${YELLOW}Cleaning old backups (retention: ${RETENTION_DAYS} days)...${NC}"
DELETED_COUNT=0
if [ -d "$BACKUP_PATH" ]; then
  while IFS= read -r old_backup; do
    rm -f "$old_backup"
    DELETED_COUNT=$((DELETED_COUNT + 1))
  done < <(find "$BACKUP_PATH" -name "backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS})

  if [ $DELETED_COUNT -gt 0 ]; then
    echo -e "${GREEN}Deleted $DELETED_COUNT old backup(s)${NC}"
  else
    echo "No old backups to delete"
  fi
fi

# 10. Summary
echo -e "\n${GREEN}Backup Complete!${NC}"
echo "================================"
echo "Backup file: $BACKUP_FILE"
echo "Size: $BACKUP_SIZE"
echo "Location: $(realpath "$BACKUP_FILE")"
echo ""
echo "Contents:"
echo "  - PostgreSQL database (custom format)"
if [ "$SKIP_MEDIA" = false ]; then
  echo "  - MinIO media files"
fi
echo "  - Backup metadata"
echo ""
echo "To restore this backup:"
echo "  ./scripts/restore.sh $BACKUP_FILE"
echo ""
echo "To list all backups:"
echo "  ls -lh $BACKUP_PATH/backup_*.tar.gz"

#!/bin/bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SKIP_MEDIA=false

# Parse arguments
BACKUP_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-media)
      SKIP_MEDIA=true
      shift
      ;;
    --help)
      echo "Support Helper — Restore Script"
      echo "Usage: ./scripts/restore.sh <backup-file> [OPTIONS]"
      echo ""
      echo "Arguments:"
      echo "  <backup-file>       Path to backup .tar.gz file"
      echo ""
      echo "Options:"
      echo "  --skip-media        Skip MinIO media restore"
      echo "  --help             Show this help message"
      exit 0
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
      else
        echo -e "${RED}Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
      fi
      shift
      ;;
  esac
done

# Validate backup file argument
if [ -z "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file is required${NC}"
  echo "Usage: ./scripts/restore.sh <backup-file> [OPTIONS]"
  echo "Use --help for more information"
  exit 1
fi

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Validate file is a tar.gz
if [[ ! "$BACKUP_FILE" =~ \.tar\.gz$ ]]; then
  echo -e "${RED}Error: Backup file must be a .tar.gz archive${NC}"
  exit 1
fi

echo -e "${GREEN}Support Helper — Restore Script${NC}"
echo "================================"
echo "Backup file: $BACKUP_FILE"
echo "Skip media: $SKIP_MEDIA"
echo ""

# Warning and confirmation
echo -e "${RED}WARNING: This will overwrite the current database and media files!${NC}"
echo -e "${YELLOW}All existing data will be replaced with the backup.${NC}"
echo ""
read -p "Are you sure you want to continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Restore cancelled${NC}"
  exit 0
fi

# 1. Check Docker is running
echo -e "\n${YELLOW}Checking Docker status...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi
echo -e "${GREEN}Docker is running${NC}"

# 2. Extract backup archive
echo -e "\n${YELLOW}Extracting backup archive...${NC}"
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find the extracted directory (should be temp_TIMESTAMP)
EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "temp_*" | head -n 1)
if [ -z "$EXTRACTED_DIR" ]; then
  echo -e "${RED}Error: Invalid backup archive structure${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

echo -e "${GREEN}Backup extracted to temporary directory${NC}"

# Display backup metadata if available
if [ -f "$EXTRACTED_DIR/metadata.txt" ]; then
  echo -e "\n${YELLOW}Backup Information:${NC}"
  cat "$EXTRACTED_DIR/metadata.txt"
  echo ""
fi

# 3. Verify backup contents
echo -e "${YELLOW}Verifying backup contents...${NC}"
if [ ! -f "$EXTRACTED_DIR/database.dump" ]; then
  echo -e "${RED}Error: Database backup not found in archive${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi
echo -e "${GREEN}Database backup found${NC}"

HAS_MEDIA=false
if [ -d "$EXTRACTED_DIR/minio" ] && [ "$(ls -A $EXTRACTED_DIR/minio)" ]; then
  HAS_MEDIA=true
  echo -e "${GREEN}Media backup found${NC}"
else
  echo -e "${YELLOW}No media backup in archive${NC}"
fi

# 4. Stop API and Worker services (keep database and storage running)
echo -e "\n${YELLOW}Stopping application services...${NC}"
docker compose stop api worker dashboard 2>/dev/null || true
echo -e "${GREEN}Application services stopped${NC}"

# 5. Restore PostgreSQL database
echo -e "\n${YELLOW}Restoring PostgreSQL database...${NC}"
echo -e "${YELLOW}This will drop and recreate all tables...${NC}"

# Ensure postgres service is running
if ! docker compose ps postgres | grep -q "Up"; then
  echo -e "${YELLOW}Starting PostgreSQL service...${NC}"
  docker compose up -d postgres
  sleep 5
fi

# Restore database using pg_restore with --clean and --if-exists
if docker compose exec -T postgres pg_restore \
  -U support \
  -d support_helper \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  < "$EXTRACTED_DIR/database.dump" 2>/dev/null; then
  echo -e "${GREEN}Database restored successfully${NC}"
else
  echo -e "${RED}Warning: Some errors occurred during database restore${NC}"
  echo -e "${YELLOW}This is often normal (e.g., dropping non-existent objects)${NC}"
fi

# 6. Restore MinIO data (if available and not skipped)
if [ "$HAS_MEDIA" = true ] && [ "$SKIP_MEDIA" = false ]; then
  echo -e "\n${YELLOW}Restoring MinIO media files...${NC}"

  # Ensure minio service is running
  if ! docker compose ps minio | grep -q "Up"; then
    echo -e "${YELLOW}Starting MinIO service...${NC}"
    docker compose up -d minio
    sleep 5
  fi

  # Stop MinIO to safely replace files
  echo -e "${YELLOW}Stopping MinIO temporarily...${NC}"
  docker compose stop minio

  # Backup current MinIO data (just in case)
  if [ -d "./data/minio" ]; then
    MINIO_BACKUP="./data/minio.backup.$(date +%s)"
    echo -e "${YELLOW}Creating safety backup of current MinIO data...${NC}"
    mv ./data/minio "$MINIO_BACKUP"
    echo -e "${GREEN}Current MinIO data backed up to: $MINIO_BACKUP${NC}"
  fi

  # Restore MinIO data
  mkdir -p ./data/minio
  cp -r "$EXTRACTED_DIR/minio/"* ./data/minio/ 2>/dev/null || true

  if [ "$(ls -A ./data/minio)" ]; then
    RESTORED_SIZE=$(du -sh ./data/minio | cut -f1)
    echo -e "${GREEN}MinIO data restored: $RESTORED_SIZE${NC}"
  else
    echo -e "${RED}Error: Failed to restore MinIO data${NC}"
    # Restore from safety backup
    if [ -d "$MINIO_BACKUP" ]; then
      rm -rf ./data/minio
      mv "$MINIO_BACKUP" ./data/minio
      echo -e "${YELLOW}Restored previous MinIO data from safety backup${NC}"
    fi
  fi

  # Restart MinIO
  echo -e "${YELLOW}Starting MinIO service...${NC}"
  docker compose up -d minio
elif [ "$HAS_MEDIA" = true ] && [ "$SKIP_MEDIA" = true ]; then
  echo -e "\n${YELLOW}Skipping MinIO restore (--skip-media flag)${NC}"
else
  echo -e "\n${YELLOW}No MinIO data to restore${NC}"
fi

# 7. Cleanup temporary directory
echo -e "\n${YELLOW}Cleaning up temporary files...${NC}"
rm -rf "$TEMP_DIR"
echo -e "${GREEN}Temporary files removed${NC}"

# 8. Restart all services
echo -e "\n${YELLOW}Starting all services...${NC}"
docker compose up -d

# 9. Wait for health check
echo -e "\n${YELLOW}Waiting for services to become healthy...${NC}"
MAX_RETRIES=30
RETRY_INTERVAL=2
for i in $(seq 1 $MAX_RETRIES); do
  if docker compose ps postgres | grep -q "healthy"; then
    echo -e "${GREEN}PostgreSQL is healthy${NC}"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    echo -e "${RED}PostgreSQL did not become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s${NC}"
    echo -e "${YELLOW}Check logs with: docker compose logs postgres${NC}"
  fi
  echo "  PostgreSQL health check $i/$MAX_RETRIES..."
  sleep $RETRY_INTERVAL
done

# Wait for API if it's configured
if docker compose ps api &>/dev/null; then
  echo -e "\n${YELLOW}Waiting for API to become healthy...${NC}"
  for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
      echo -e "${GREEN}API is healthy${NC}"
      break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
      echo -e "${RED}API did not become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s${NC}"
      echo -e "${YELLOW}Check logs with: docker compose logs api${NC}"
    fi
    echo "  API health check $i/$MAX_RETRIES..."
    sleep $RETRY_INTERVAL
  done
fi

# 10. Summary
echo -e "\n${GREEN}Restore Complete!${NC}"
echo "================================"
echo "Restored from: $BACKUP_FILE"
echo ""
echo "Services restored:"
echo "  - PostgreSQL database"
if [ "$HAS_MEDIA" = true ] && [ "$SKIP_MEDIA" = false ]; then
  echo "  - MinIO media files"
fi
echo ""
echo "Next steps:"
echo "  1. Verify the application is working correctly"
echo "  2. Check logs: docker compose logs -f"
echo "  3. Access dashboard: http://localhost:3000"
echo ""
if [ -n "${MINIO_BACKUP:-}" ] && [ -d "$MINIO_BACKUP" ]; then
  echo "Safety backup of previous MinIO data:"
  echo "  $MINIO_BACKUP"
  echo "  You can delete this once you've verified the restore"
  echo ""
fi

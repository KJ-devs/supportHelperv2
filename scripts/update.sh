#!/bin/bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Support Helper — Update Script${NC}"
echo "================================"

# 1. Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running${NC}"
  exit 1
fi

# 2. Show current version
echo -e "\n${YELLOW}Checking current version...${NC}"
CURRENT_VERSION=$(docker compose exec -T api node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
echo "Current version: $CURRENT_VERSION"

# 3. Create database backup
echo -e "\n${YELLOW}Creating database backup...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec -T postgres pg_dump -U postgres support_helper > "$BACKUP_FILE" 2>/dev/null
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}"
else
  echo -e "${RED}Warning: Backup may be empty or failed${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 4. Pull latest images
echo -e "\n${YELLOW}Pulling latest images...${NC}"
docker compose pull

# 5. Restart services (with graceful shutdown)
echo -e "\n${YELLOW}Restarting services...${NC}"
docker compose up -d

# 6. Wait for health check
echo -e "\n${YELLOW}Waiting for API to become healthy...${NC}"
MAX_RETRIES=30
RETRY_INTERVAL=2
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}API is healthy!${NC}"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    echo -e "${RED}API did not become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    echo "To rollback manually, restore the backup: psql -U postgres support_helper < $BACKUP_FILE"
    exit 1
  fi
  echo "  Attempt $i/$MAX_RETRIES..."
  sleep $RETRY_INTERVAL
done

# 7. Show new version
echo -e "\n${YELLOW}Checking new version...${NC}"
NEW_VERSION=$(curl -sf http://localhost:3001/api/system/version 2>/dev/null | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).current))" 2>/dev/null || echo "unknown")
echo "New version: $NEW_VERSION"

# 8. Done
echo -e "\n${GREEN}Update complete!${NC}"
echo "================================"
echo "Database backup: $BACKUP_FILE"
echo ""
echo "If something went wrong, rollback with:"
echo "  1. docker compose down"
echo "  2. psql -U postgres support_helper < $BACKUP_FILE"
echo "  3. docker compose up -d"

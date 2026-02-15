#!/bin/sh
# ============================================================
# Docker entrypoint for Support Helper services
# Handles: database readiness check, Prisma migrations, app start
#
# Environment variables:
#   DATABASE_URL     - PostgreSQL connection string (required)
#   RUN_MIGRATIONS   - Set to "true" to run Prisma migrations before start (API only)
#   PRISMA_SCHEMA    - Path to Prisma schema file (default: apps/api/prisma/schema.prisma)
#
# Usage in docker-compose:
#   entrypoint: ["/app/docker/entrypoint.sh"]
#   command: ["dumb-init", "node", "apps/api/dist/src/main.js"]
# ============================================================

set -e

# ── Defaults ──────────────────────────────────────────────────
PRISMA_SCHEMA="${PRISMA_SCHEMA:-apps/api/prisma/schema.prisma}"
MAX_RETRIES=30
RETRY_INTERVAL=2
ADVISORY_LOCK_ID=72910
MIGRATION_WAIT_RETRIES=30
MIGRATION_WAIT_INTERVAL=3

# ── Extract DB host and port from DATABASE_URL ────────────────
# DATABASE_URL format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT="${DB_PORT:-5432}"

# ── Wait for PostgreSQL ───────────────────────────────────────
echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."

retries=0
while [ "$retries" -lt "$MAX_RETRIES" ]; do
  # Try a TCP connection to the database port
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "[entrypoint] PostgreSQL is reachable at ${DB_HOST}:${DB_PORT}"
    break
  fi

  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: PostgreSQL not reachable after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi

  echo "[entrypoint] PostgreSQL not ready (attempt ${retries}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

# ── Run Prisma migrations (API only) ─────────────────────────
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Attempting to acquire advisory lock (ID: ${ADVISORY_LOCK_ID}) for migrations..."

  # Try to acquire advisory lock to prevent concurrent migrations
  LOCK_RESULT=$(psql "$DATABASE_URL" -t -A -c "SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID})" 2>/dev/null || echo "error")

  if [ "$LOCK_RESULT" = "t" ]; then
    echo "[entrypoint] Advisory lock acquired. Running Prisma migrations (schema: ${PRISMA_SCHEMA})..."

    # Release the advisory lock on exit (success or failure)
    release_lock() {
      echo "[entrypoint] Releasing advisory lock (ID: ${ADVISORY_LOCK_ID})..."
      psql "$DATABASE_URL" -c "SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})" > /dev/null 2>&1 || true
    }
    trap release_lock EXIT

    if npx prisma migrate deploy --schema="$PRISMA_SCHEMA" 2>&1; then
      echo "[entrypoint] Migrations applied successfully."
    else
      echo "[entrypoint] ERROR: Migration failed. Check logs above."
      echo "[entrypoint] The application will NOT start to prevent data inconsistency."
      echo ""
      echo "[entrypoint] ROLLBACK PROCEDURE:"
      echo "  1. Check migration status:  npx prisma migrate status --schema=${PRISMA_SCHEMA}"
      echo "  2. Fix the failing migration SQL manually in the migrations/ directory"
      echo "  3. If a migration was partially applied, manually revert the SQL changes in the database"
      echo "  4. Mark migration as rolled back:  npx prisma migrate resolve --rolled-back <migration_name> --schema=${PRISMA_SCHEMA}"
      echo "  5. Or mark as applied (if fixed manually):  npx prisma migrate resolve --applied <migration_name> --schema=${PRISMA_SCHEMA}"
      echo "  6. Restart the container"
      exit 1
    fi

    # Clear the EXIT trap and release lock manually (so exec below doesn't trigger it)
    trap - EXIT
    release_lock
  else
    echo "[entrypoint] Advisory lock NOT acquired — another instance is running migrations."
    echo "[entrypoint] Waiting for migrations to complete..."

    # Wait for the other instance to finish (lock becomes available)
    wait_retries=0
    while [ "$wait_retries" -lt "$MIGRATION_WAIT_RETRIES" ]; do
      # Check if we can now acquire (and immediately release) the lock
      CHECK_RESULT=$(psql "$DATABASE_URL" -t -A -c "SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID})" 2>/dev/null || echo "error")
      if [ "$CHECK_RESULT" = "t" ]; then
        # Lock acquired — the other instance finished; release immediately
        psql "$DATABASE_URL" -c "SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})" > /dev/null 2>&1 || true
        echo "[entrypoint] Migrations completed by another instance. Proceeding."
        break
      fi

      wait_retries=$((wait_retries + 1))
      if [ "$wait_retries" -ge "$MIGRATION_WAIT_RETRIES" ]; then
        echo "[entrypoint] WARNING: Timed out waiting for migrations (${MIGRATION_WAIT_RETRIES} attempts). Proceeding anyway."
        break
      fi

      echo "[entrypoint] Still waiting for migrations (attempt ${wait_retries}/${MIGRATION_WAIT_RETRIES})..."
      sleep "$MIGRATION_WAIT_INTERVAL"
    done
  fi
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS != true)."
fi

# ── Start the application ────────────────────────────────────
echo "[entrypoint] Starting application: $*"
exec "$@"

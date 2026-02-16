# Updating Support Helper

## Quick Update

Run the update script from your installation directory:

```bash
./scripts/update.sh
```

This will:
1. Create a database backup
2. Pull the latest Docker images
3. Restart services with zero-downtime
4. Verify the API is healthy
5. Display the new version

## Manual Update

If you prefer to update manually:

```bash
# 1. Backup the database
docker compose exec postgres pg_dump -U postgres support_helper > backup.sql

# 2. Pull latest images
docker compose pull

# 3. Restart services
docker compose up -d

# 4. Verify health
curl http://localhost:3001/api/health
```

## Rollback

If something goes wrong after an update:

```bash
# 1. Stop services
docker compose down

# 2. Restore database from backup
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres support_helper < backup.sql

# 3. Pull previous version (replace X.Y.Z with the desired version)
# Edit docker-compose.yml to pin the image version
# e.g., image: support-helper/api:0.1.0

# 4. Restart
docker compose up -d
```

## Database Migrations

Migrations run automatically on startup (see US-7.2). When the API starts, it:
1. Checks for pending migrations
2. Applies them in order
3. Verifies the database schema is compatible

No manual migration step is needed.

## Version Compatibility

Check the current version and database compatibility:

```bash
curl http://localhost:3001/api/system/version
```

Response:
```json
{
  "current": "0.2.0",
  "dbVersion": "20260216220000_add_license_usage",
  "dbCompatible": true,
  "nodeVersion": "v20.18.0",
  "uptime": 3600
}
```

## Changelog

After each update, check the changelog in the dashboard under **Settings > About** or view the [CHANGELOG.md](../../CHANGELOG.md) file.

# Self-Hosted Installation Guide

This guide walks you through deploying Support Helper Platform on your own server using Docker Compose.

## Prerequisites

- **Docker Engine** 24+ and **Docker Compose** v2+
- **4 GB RAM** minimum (2.8 GB allocated to containers, headroom for the host OS)
- **10 GB disk** minimum (images, volumes, logs)
- **Git** (to clone the repository)
- **openssl** or **Node.js 20+** (to generate secrets)

Verify your environment:

```bash
docker --version        # Docker Engine 24+
docker compose version  # Docker Compose v2+
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/KJ-devs/supportHelperv2.git
cd supportHelperv2

# 2. Generate secrets
./scripts/generate-secrets.sh --write .env

# 3. Edit .env with your settings (see Configuration below)
#    At minimum, review POSTGRES_USER and DASHBOARD_URL
nano .env

# 4. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verify all services are healthy
docker compose -f docker-compose.prod.yml ps
```

The API runs automatic Prisma migrations on first startup (`RUN_MIGRATIONS=true`). The dashboard is available once the API health check passes.

## Architecture Overview

The production stack consists of six services:

| Service       | Image                     | Default Port | Purpose                          |
|---------------|---------------------------|-------------|----------------------------------|
| **postgres**  | pgvector/pgvector:pg16    | 5432        | Primary database (with pgvector) |
| **redis**     | redis:7.4-alpine          | 6379        | Cache, BullMQ job queue          |
| **minio**     | minio/minio:latest        | 9000/9001   | S3-compatible object storage     |
| **api**       | Built from apps/api/      | 3001        | NestJS REST API                  |
| **worker**    | Built from apps/worker/   | -           | Background job processor         |
| **dashboard** | Built from apps/dashboard/| 3000        | Next.js admin dashboard          |

Startup order is enforced by health checks:
`postgres + redis + minio` -> `api` (runs migrations) -> `worker + dashboard`

## Configuration

### Required Environment Variables

These must be set in your `.env` file before starting:

| Variable              | Description                                    |
|-----------------------|------------------------------------------------|
| `POSTGRES_USER`       | PostgreSQL username                            |
| `POSTGRES_PASSWORD`   | PostgreSQL password                            |
| `REDIS_PASSWORD`      | Redis authentication password                  |
| `MINIO_ROOT_USER`     | MinIO root username                            |
| `MINIO_ROOT_PASSWORD` | MinIO root password                            |
| `JWT_SECRET`          | JWT access token signing key (64-char hex)     |
| `JWT_REFRESH_SECRET`  | JWT refresh token signing key (64-char hex)    |

### Optional Environment Variables

| Variable                     | Default              | Description                        |
|------------------------------|----------------------|------------------------------------|
| `POSTGRES_DB`                | `support_helper`     | Database name                      |
| `S3_BUCKET`                  | `videos`             | Default S3 bucket for uploads      |
| `S3_REGION`                  | `us-east-1`          | S3 region                          |
| `JWT_EXPIRES_IN`             | `30m`                | Access token lifetime              |
| `JWT_REFRESH_EXPIRES_IN`     | `30d`                | Refresh token lifetime             |
| `DASHBOARD_URL`              | `http://localhost:3000` | Dashboard URL (used for CORS)   |
| `API_URL`                    | `http://localhost:3001` | Public API URL                  |
| `OPENAI_API_KEY`             | -                    | Enables AI video analysis          |
| `ENCRYPTION_KEY`             | -                    | Encrypts sensitive data at rest    |
| `INTEGRATION_ENCRYPTION_KEY` | -                    | Encrypts third-party credentials   |

For a complete list of variables, see `.env.example` in the repository root.

### Port Overrides

Default ports can be changed via environment variables:

```bash
POSTGRES_PORT=5432
REDIS_PORT=6379
API_PORT=3001
DASHBOARD_PORT=3000
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

## Secrets Generation

Use the included script to generate all required cryptographic secrets:

```bash
# Print secrets to stdout (for manual copy-paste)
./scripts/generate-secrets.sh

# Automatically append to .env file
./scripts/generate-secrets.sh --write .env
```

The script generates:
- `JWT_SECRET` - access token signing key
- `JWT_REFRESH_SECRET` - refresh token signing key
- `ENCRYPTION_KEY` - data-at-rest encryption key
- `INTEGRATION_ENCRYPTION_KEY` - third-party integration credentials encryption
- `GITHUB_WEBHOOK_SECRET` - GitHub webhook signature verification
- `REDIS_PASSWORD` - Redis authentication password
- `POSTGRES_PASSWORD` - PostgreSQL password

All secrets are 64-character hex strings (256-bit) generated via `openssl rand -hex 32`.

**Important:** Never commit your `.env` file to version control. The `.gitignore` already excludes `.env*` files (except `.env.example`).

## First Launch

### 1. Build the Docker Images

```bash
docker compose -f docker-compose.prod.yml build
```

This builds three application images:
- **API** (`apps/api/Dockerfile`): 3-stage build, node:20-alpine, includes Prisma client
- **Worker** (`apps/worker/Dockerfile`): 3-stage build, node:20-slim (includes ffmpeg + tesseract for video processing)
- **Dashboard** (`apps/dashboard/Dockerfile`): 3-stage build, node:20-alpine, Next.js standalone output

Build context is the repository root for all images.

### 2. Start the Stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. Watch the Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# API only (to monitor migration status)
docker compose -f docker-compose.prod.yml logs -f api
```

On first startup, you will see:
1. PostgreSQL initializing (extensions: `uuid-ossp`, `vector`, `pg_trgm`)
2. Redis starting with password authentication
3. MinIO starting, then `minio-init` creating buckets (`videos`, `screenshots`, `exports`)
4. The API entrypoint (`docker/entrypoint.sh`) waiting for PostgreSQL, then running Prisma migrations
5. Dashboard starting after the API health check passes

### 4. Create the First User

After all services are healthy, register the first admin user via the API:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

Then log into the dashboard at `http://localhost:3000`.

## Verification

### Health Check

The API exposes public health endpoints:

```bash
# Liveness probe - is the process running?
curl http://localhost:3001/health/live
# Expected: {"status":"ok"}

# Readiness probe - are all dependencies available?
curl http://localhost:3001/health/ready
# Expected: {"status":"ok"}

# Comprehensive health - full dependency status
curl http://localhost:3001/health
# Expected: {"status":"healthy","services":{"postgres":...,"redis":...,"minio":...}}
```

### Service Status

```bash
# Check all container statuses
docker compose -f docker-compose.prod.yml ps

# Expected: all services show "healthy" or "running"
```

### MinIO Console

Access the MinIO web console at `http://localhost:9001` with your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` credentials to verify buckets were created.

## Updating

### Standard Update

```bash
# 1. Pull the latest code
git pull origin master

# 2. Rebuild images
docker compose -f docker-compose.prod.yml build

# 3. Restart services (API auto-runs migrations)
docker compose -f docker-compose.prod.yml up -d

# 4. Verify health
curl http://localhost:3001/health/ready
```

### Rolling Back

If a migration fails, the API container will exit and print rollback instructions in the logs. To roll back manually:

```bash
# Check migration status
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate status --schema=apps/api/prisma/schema.prisma

# Mark a failed migration as rolled back
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate resolve --rolled-back <migration_name> \
  --schema=apps/api/prisma/schema.prisma
```

## Backup

### Database Backup

```bash
# Create a backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB:-support_helper} \
  --format=custom --compress=9 > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore a backup
docker compose -f docker-compose.prod.yml exec -i postgres \
  pg_restore -U ${POSTGRES_USER} -d ${POSTGRES_DB:-support_helper} \
  --clean --if-exists < backup_20260215_120000.dump
```

### MinIO Data Backup

MinIO data is stored in the `minio_data` Docker volume. Back it up using:

```bash
# Find the volume mount point
docker volume inspect supporthelperv2_minio_data

# Or use mc (MinIO client) to mirror data
docker run --rm --network sh-prod-network \
  -v ./minio-backup:/backup \
  minio/mc sh -c "
    mc alias set src http://minio:9000 \${MINIO_ROOT_USER} \${MINIO_ROOT_PASSWORD};
    mc mirror src/ /backup/
  "
```

### Redis Backup

Redis persistence is handled via AOF (append-only file) in the `redis_data` volume. For a point-in-time snapshot:

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli -a ${REDIS_PASSWORD} BGSAVE
```

### Full Volume Backup

```bash
# Stop services before backing up volumes
docker compose -f docker-compose.prod.yml stop

# Backup all volumes
for vol in postgres_data redis_data minio_data; do
  docker run --rm -v supporthelperv2_${vol}:/data -v $(pwd)/backups:/backup \
    alpine tar czf /backup/${vol}_$(date +%Y%m%d).tar.gz -C /data .
done

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

## Memory Limits

The production stack is configured for a 4 GB RAM target:

| Service       | Memory Limit |
|---------------|-------------|
| PostgreSQL    | 512 MB      |
| Redis         | 192 MB      |
| MinIO         | 256 MB      |
| API           | 512 MB      |
| Worker        | 1 GB        |
| Dashboard     | 256 MB      |
| **Total**     | **~2.8 GB** |

Adjust limits in `docker-compose.prod.yml` under `deploy.resources.limits.memory` if your server has more RAM.

## Troubleshooting

### API Container Keeps Restarting

**Symptoms:** API exits with code 1, restarts in a loop.

**Common causes:**
1. **PostgreSQL not ready** - Check postgres container logs. The entrypoint retries 30 times before giving up.
2. **Missing required env vars** - Docker Compose fails fast on missing `JWT_SECRET`, `POSTGRES_USER`, etc. Check the error message.
3. **Migration failure** - Check API logs for Prisma migration errors. See the Rolling Back section above.

```bash
docker compose -f docker-compose.prod.yml logs api
```

### Cannot Connect to Dashboard

**Check:** Is the API healthy first?
```bash
curl http://localhost:3001/health/ready
```

If the API is not ready, the dashboard depends on it and will not start.

**Check:** CORS configuration. Ensure `DASHBOARD_URL` matches the URL you are using to access the dashboard.

### MinIO Buckets Not Created

The `minio-init` service runs once. If it failed:

```bash
# Re-run bucket initialization
docker compose -f docker-compose.prod.yml up minio-init
```

### Worker Not Processing Jobs

**Check:** Worker logs for connection errors.
```bash
docker compose -f docker-compose.prod.yml logs worker
```

**Common causes:**
- Redis connection failure (check `REDIS_PASSWORD` matches)
- Missing `OPENAI_API_KEY` (AI analysis jobs will fail, but other jobs continue)
- Worker depends on the API being healthy first

### Out of Memory

If containers are being OOM-killed:

```bash
# Check which container was killed
docker compose -f docker-compose.prod.yml ps

# Check Docker events
docker events --filter type=container --filter event=oom --since 1h
```

Increase the memory limit for the affected service in `docker-compose.prod.yml`.

### Resetting Everything

To start from a completely clean state (destroys all data):

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
```

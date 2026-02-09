# DevOps Agent Memory

## Infrastructure Stack
- **Docker Compose services**: PostgreSQL (pgvector:pg16), Redis 7.4, MeiliSearch v1.11, MailHog, MinIO + MinIO-init
- **Ports**: PostgreSQL=5432, Redis=6379, MeiliSearch=7700, MailHog SMTP=1025/UI=8025, MinIO API=9000/Console=9001
- **Test infra** (`docker-compose.test.yml`): Offset ports: PG=5433, Redis=6380, MinIO=9002/9003, Meili=7701
- **Network**: `support-helper-network` (bridge)

## Environment Setup (2026-02-09)
- WSL2 environment on Windows
- **Node.js**: Only available as Windows `node.exe` (v24.13.0) -- no native Linux `node` in WSL
- **pnpm**: Points to Windows pnpm at `/mnt/c/Users/krebs/AppData/Roaming/npm/pnpm` -- fails because `node` not in WSL PATH
- **Docker**: NOT installed in WSL2 and Docker Desktop is NOT running on Windows side
- **node_modules**: Exist at root with pnpm store (installed previously via Windows)
- **Prisma migrations**: 3 migrations exist (init, add_integrations, integration)

## Env File Analysis
- `.env.local` and `.env` are nearly identical (both have real OPENAI_API_KEY)
- `.env.example` has `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` (missing from .env.local/.env)
- `.env.example` uses `JWT_EXPIRES_IN=30m`, but .env.local/.env use `JWT_EXPIRES_IN=7d`
- `apps/api/.env` only contains DATABASE_URL
- Worker has its own `.env.example` with worker-specific vars (WORKER_PORT, WORKER_CONCURRENCY, YOLO_WEIGHTS_PATH)

## Critical Blockers
1. No native `node` in WSL2 PATH -- pnpm/build cannot execute
2. Docker not available -- infrastructure services cannot start
3. Missing JWT refresh token env vars in .env.local

## Monorepo Config
- pnpm-workspace.yaml: `apps/*` and `packages/*`
- turbo.json: Standard pipeline (build -> test, dev persistent, db:migrate/seed no-cache)
- PostgreSQL init.sql enables: uuid-ossp, vector (pgvector), pg_trgm

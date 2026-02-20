# DevOps Agent Memory

## Infrastructure Stack
- **Docker Compose services**: PostgreSQL (pgvector:pg16), Redis 7.4, MeiliSearch v1.11, MailHog, MinIO + MinIO-init
- **Ports**: PostgreSQL=5432, Redis=6379, MeiliSearch=7700, MailHog SMTP=1025/UI=8025, MinIO API=9000/Console=9001
- **Test infra** (`docker-compose.test.yml`): Offset ports: PG=5433, Redis=6380, MinIO=9002/9003, Meili=7701
- **Network**: `support-helper-network` (bridge)

## Audit complet (2026-02-10)
**Voir AUDIT.md pour le rapport détaillé**

### Workspaces status
| Workspace | Build | Tests | Status |
|-----------|-------|-------|--------|
| packages/shared | ✅ OK | N/A | Stable |
| packages/database | ✅ OK | N/A | Stable |
| packages/sdk-web | ✅ OK | N/A | ⚠️ CDN build manquant |
| apps/api | ✅ OK | ❌ 7 failed | ⚠️ AuthService tests cassés |
| apps/worker | ✅ OK | N/A | Stable (strict:false) |
| apps/dashboard | ✅ OK | N/A | Stable |
| apps/web | ✅ OK | N/A | Stable |

### Bloqueurs critiques
1. ✅ **RÉSOLU (2026-02-12)** - **SDK CDN build manquant** - Automatisé dans CI/CD pipeline
   - Build CDN intégré dans `ci.yml` et `release.yml`
   - Vérification obligatoire des artefacts (build fails si manquant)
   - Workflow dédié `deploy-sdk-cdn.yml` pour déploiement S3/CloudFront
   - Commande locale: `pnpm --filter @support-helper/sdk-web build:cdn`
2. **API tests échoués** - AuthService: ConfigService manquant dans les mocks (7/129 tests failed)
3. **Docker Desktop arrêté** - impossible de démarrer l'infra

### Incohérences mineures
- `@repo/web` devrait être `@support-helper/web`
- ✅ **CORRIGÉ (2026-02-10)** : `passport-custom` dupliqué - retiré du root package.json
- Variables S3: `S3_ACCESS_KEY` (racine) vs `S3_ACCESS_KEY_ID` (worker)
- Worker en `strict: false` (masque erreurs TypeScript)
- 162 warnings lint (principalement `any` types)

## Environment Setup
- **OS**: Windows avec WSL2
- **Node.js**: v24.13.0 (accessible via Windows, pas dans WSL)
- **pnpm**: 8.15.0 (via Windows)
- **Docker**: v29.1.3 installé MAIS Docker Desktop arrêté
- **Builds**: Tous réussis via pnpm depuis Windows

## Env File Analysis
- `.env.example` (racine): complet, bien documenté
- `apps/worker/.env.example`: spécifique worker avec noms variables différents
- Différences S3: `S3_ACCESS_KEY` vs `S3_ACCESS_KEY_ID`
- Différences Meili: `MEILISEARCH_MASTER_KEY` vs `MEILISEARCH_API_KEY`

## Monorepo Config
- pnpm-workspace.yaml: `apps/*` and `packages/*` ✅
- turbo.json: Standard pipeline (build -> test, dev persistent, db:migrate/seed no-cache) ✅
- PostgreSQL init.sql enables: uuid-ossp, vector (pgvector), pg_trgm
- TypeScript: `tsconfig.base.json` étendu par packages + dashboard, mais API/worker/web ont configs indépendants (justifié)
- **Dépendances internes**: Toutes utilisent `workspace:*` ✅

## Phase 2 : Fondations (2026-02-10)
**Status**: COMPLETEE
- `pnpm install` fonctionne sans erreur
- `pnpm build` réussit pour tous les workspaces (7/7)
- Correction appliquée : `passport-custom` retiré du root package.json
- **Rapport complet** : `docs/audit/PHASE2_REPORT.md`

## Dockerfiles (2026-02-15)
- `apps/api/Dockerfile` - 3-stage (deps/build/prod), node:20-alpine, pnpm@9.15.4 via corepack
- `apps/worker/Dockerfile` - 3-stage, node:20-slim (needs apt for ffmpeg+tesseract)
- `apps/dashboard/Dockerfile` - 3-stage, node:20-alpine, Next.js standalone output
- `.dockerignore` (root) - excludes node_modules, dist, .next, tests, .env, .git, docs
- Build context = repo root for all Dockerfiles
- Both shared packages (`shared`, `database`) extend `tsconfig.base.json` - must be copied in build stage
- Worker references `../api/prisma/schema.prisma` - api's prisma dir must be present
- API `start:prod` says `dist/src/main` but actual NestJS output is `dist/main.js` (possible typo in package.json)
- Worker uses `dist/main` which is correct
- Dashboard uses `output: 'standalone'` in next.config.mjs (EPERM symlink error on Windows, works in Docker/Linux)

## Production Docker Compose (2026-02-15)
- `docker-compose.prod.yml` - Full production stack
- Services: postgres, redis, minio, minio-init, api, worker, dashboard
- No MeiliSearch or MailHog (dev-only)
- Required env vars enforced with `${VAR:?message}` syntax
- Redis requires password in production (`REDIS_PASSWORD`)
- Memory limits total ~2.8GB (fits 4GB target): PG=512M, Redis=192M, MinIO=256M, API=512M, Worker=1G, Dashboard=256M
- Named Docker volumes for persistence: postgres_data, redis_data, minio_data
- Startup order: postgres/redis/minio -> api -> worker/dashboard
- Network: `sh-prod-network` (separate from dev `support-helper-network`)
- Configurable ports via env vars: POSTGRES_PORT, REDIS_PORT, API_PORT, DASHBOARD_PORT, MINIO_API_PORT, MINIO_CONSOLE_PORT

## Windows Prisma DLL Locking (2026-02-12)
**Problem**: `pnpm db:generate` fails with EPERM on `query_engine-windows.dll.node` rename
**Root cause**: Node.js process holding lock on old DLL, preventing Prisma from replacing it
**Quick fix**: `rm -f node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/query_engine-windows.dll.node && pnpm db:generate`
**Prevention workflow**:
1. Always stop dev servers before `pnpm db:generate`: `Ctrl+C` in all terminal tabs
2. Check for orphaned Node processes: `powershell.exe -Command "Get-Process node -ErrorAction SilentlyContinue"`
3. If locked, delete the DLL directly (Prisma recreates it from temp files)
4. Alternative: Full cleanup with `pnpm clean && pnpm install` (slower)

## SDK CDN Build
- CDN build is separate: `pnpm --filter @support-helper/sdk-web build:cdn`
- Output: `packages/sdk-web/dist/cdn/sdk.iife.js`
- Documentation: `packages/sdk-web/CDN_SETUP.md`

## Production Monitoring (2026-02-17)
**Status**: IMPLEMENTED (PR #164)
- **Prometheus metrics** endpoint at `/metrics` (enabled via `PROMETHEUS_ENABLED=true`)
- **MetricsService** tracks:
  - HTTP: requests/sec, p95 latency, error rate, in-flight
  - Database: query duration, connection pool utilization
  - Queue: backlog, job duration, failure rate
  - Business: tickets created, video processing time, AI analysis time, integration syncs
  - Cache: hit/miss rates
- **MetricsInterceptor** automatically records all HTTP requests
- **Alert rules** (`monitoring/prometheus/alerts.yml`):
  - Critical: error rate >5%, p95 >5s, DB/Redis down, queue >5000
  - Warning: p95 >2s, DB pool >80%, queue >1000, job failure >10%
  - Info: cache hit rate <70%
- **Alertmanager** configured for Slack notifications with severity-based routing
- **Grafana dashboard** with 14 panels (performance, resources, queues, business metrics)
- **docker-compose.monitoring.yml** deploys full stack: Prometheus, Alertmanager, Grafana, postgres_exporter, redis_exporter, node_exporter
- **Runbooks** created:
  - `docs/runbooks/high-error-rate.md` - debugging 5xx errors
  - `docs/runbooks/queue-backlog.md` - resolving queue congestion
- **Documentation**: `docs/monitoring/README.md` (comprehensive guide), `docs/monitoring/SETUP.md` (setup instructions)
- Already installed: `prom-client@15.1.3` in API package.json

## Note
- GitHub Actions workflows were removed (2026-02-14) to streamline development
- Quality is now enforced locally via agent quality gates (build + test before delivering)

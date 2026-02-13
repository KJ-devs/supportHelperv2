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

**CI Pipeline Changes**:
1. `ci.yml` build job now runs `pnpm --filter @support-helper/sdk-web build:cdn`
2. Verification step ensures `dist/cdn/sdk.iife.js` and sourcemap exist (fails CI if missing)
3. Uploads SDK CDN artifacts separately (30-day retention)

**Release Pipeline Changes**:
1. `release.yml` publish-sdk job builds both npm packages + CDN bundle
2. Optional S3 upload with versioned URLs: `sdk@{version}.js` (immutable, 1-year cache)
3. Optional `@latest` tag update (5-minute cache)
4. CloudFront cache invalidation support
5. GitHub Release notes include CDN URLs (S3 + jsDelivr)

**Dedicated CDN Deployment**:
- `deploy-sdk-cdn.yml` workflow for standalone CDN deployments
- Triggers: pushes to main affecting SDK, manual workflow_dispatch
- Supports custom versioning via manual trigger
- Graceful degradation: works without AWS secrets (jsDelivr-only)
- Optional secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_CDN_BUCKET, CDN_DOMAIN, CLOUDFRONT_DISTRIBUTION_ID

**CDN Strategy**:
- **Primary (zero-config)**: jsDelivr automatically serves from npm publish
- **Secondary (optional)**: Custom S3/CloudFront for enterprise deployments
- **Versioning**: Semantic versioning with immutable versioned URLs + mutable @latest tag
- **Security**: SRI hash support documented, CORS configured

**Key URLs**:
- Versioned (jsDelivr): `https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@{version}/dist/cdn/sdk.iife.js`
- Latest (jsDelivr): `https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@latest/dist/cdn/sdk.iife.js`
- Custom S3 (if configured): `https://{CDN_DOMAIN}/sdk@{version}.js`

**Documentation**:
- `CDN_SETUP.md`: Complete setup guide for S3/CloudFront, versioning strategy, troubleshooting
- README.md: Updated with CDN usage examples, SRI hash generation, framework integration

## Database Backups (2026-02-13) - US-007
**Implementation**: Fully automated PostgreSQL backup system with S3 storage and retention
**Status**: ✅ COMPLETE - All 5 components implemented

**Files created**:
- `scripts/backup-database.sh` - Production-ready backup script (5.9KB, executable)
- `scripts/cleanup-old-backups.sh` - Retention policy enforcement (4.9KB, executable)
- `.github/workflows/database-backup.yml` - Automated daily backup workflow (4.2KB)
- `docs/runbooks/database-restore.md` - Comprehensive restore runbook (6.8KB)
- `docs/DATABASE_BACKUPS.md` - System documentation (3.1KB)
- `.env.example` - Added BACKUP_BUCKET and SLACK_WEBHOOK_URL variables

**Backup Script Features**:
- Uses pg_dump with gzip compression (plain SQL format)
- Parses DATABASE_URL or individual POSTGRES_* variables
- Uploads to S3 with AES256 server-side encryption
- STANDARD_IA storage class (cost-optimized for infrequent access)
- Sends Slack notifications (success/failure with details)
- Validates backup before and after upload (size check, S3 ls verification)
- Color-coded console output (RED/GREEN/YELLOW)
- Exit codes: 0=Success, 1=Missing env, 2=pg_dump failed, 3=S3 upload failed

**Retention Policy** (implemented in cleanup script):
- Daily: Keep last 7 days (all backups)
- Weekly: Keep last 4 Sundays
- Monthly: Keep last 12 first-of-month backups
- Auto-cleanup runs after each backup (configurable)

**GitHub Actions Workflow**:
- Schedule: Daily at 2 AM UTC (cron '0 2 * * *')
- Manual trigger: workflow_dispatch with skip_cleanup option
- Installs PostgreSQL client tools
- Configures AWS credentials via aws-actions/configure-aws-credentials@v4
- Runs backup script with full env vars
- Verifies backup uploaded to S3 (size >1KB check)
- Runs retention cleanup (unless skipped)
- Sends Slack notification on failure

**Required GitHub Secrets**:
- BACKUP_BUCKET (S3 bucket name)
- PRODUCTION_DATABASE_URL (or individual POSTGRES_* vars)
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION (optional, defaults to us-east-1)
- SLACK_WEBHOOK_URL (optional)

**Backup Format**:
- Filename: `support-helper-db-backup-YYYYMMDD_HHMMSS.sql.gz`
- Format: Plain SQL (--format=plain --no-owner --no-acl)
- Compression: gzip
- S3 encryption: AES256 (server-side)
- S3 metadata: database name, timestamp, hostname

**Restore Runbook Includes**:
- Prerequisites checklist
- Backup listing and download procedures
- Integrity verification (gunzip -t)
- Test restore on test database (mandatory before production)
- Production restore with pre-backup creation
- Post-restore verification checklist (health checks, smoke tests)
- Rollback procedure (restore from pre-backup)
- Troubleshooting: "database being accessed", "extension vector not available", "gzip CRC error"

**Estimated Costs** (AWS):
- 30 backups @ 150MB compressed = ~$0.07/month (STANDARD_IA)
- 30 backups @ 1GB compressed = ~$0.38/month
- Negligible PUT/GET/transfer costs for normal usage

**Testing Checklist** (from TODO):
- [ ] Run backup script on staging
- [ ] Verify S3 upload
- [ ] Test restore on test database
- [ ] Verify Slack notifications
- [ ] Test GitHub Action manual trigger
- [ ] Verify retention policy (run cleanup script)

**Next Steps** (manual testing required):
1. Create S3 bucket for backups
2. Create IAM user with S3 permissions
3. Configure GitHub Secrets
4. Run manual workflow trigger to test
5. Verify Slack webhook integration
6. Perform test restore to validate backup integrity

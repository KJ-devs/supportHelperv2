Affiche les commandes de developpement du projet Support Helper.

## Initial Setup

```bash
pnpm install                    # Install all dependencies
cp .env.example .env.local      # Configure environment
pnpm docker:up                  # Start PostgreSQL, Redis, MinIO, MeiliSearch, MailHog
pnpm db:migrate                 # Run database migrations
pnpm db:seed                    # Seed test data
```

## Development

```bash
pnpm dev                        # Start all services (API :3001, Dashboard :3000)
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm format                     # Format code with Prettier
```

## Database

```bash
pnpm db:migrate                 # Create and apply migrations (Prisma)
pnpm db:generate                # Generate Prisma client for API + Worker
pnpm db:studio                  # Open Prisma Studio GUI
pnpm db:seed                    # Seed database with test data
```

## Package-Specific

```bash
pnpm --filter @support-helper/api [command]
pnpm --filter @support-helper/dashboard [command]
pnpm --filter @support-helper/sdk-web [command]
pnpm --filter @support-helper/worker [command]

# SDK CDN build (required for widget to render)
pnpm --filter @support-helper/sdk-web build:cdn
```

## Testing (IMPORTANT: Resource Management)

- NEVER run `pnpm test` globally — consumes all RAM
- Always test one package at a time with `--maxWorkers=2`
- If `pnpm dev` is running (~4 GB RAM), use `--maxWorkers=1`

```bash
pnpm --filter @support-helper/api test -- --maxWorkers=2
pnpm --filter @support-helper/worker test -- --maxWorkers=2
pnpm --filter @support-helper/dashboard test

# Changed files only (fastest)
cd apps/api && npx jest --maxWorkers=2 --no-coverage --changedSince=HEAD~1
cd apps/dashboard && npx vitest run --no-coverage --changed

# Specific test file
cd apps/api && npx jest --maxWorkers=1 --no-coverage <pattern>
```

## Frameworks

- API + Worker: Jest (`*.spec.ts`)
- Dashboard: Vitest (`*.test.ts`)

## Environment Variables

See `.env.example` for full list. Key ones:

- `DATABASE_URL` — PostgreSQL
- `REDIS_URL` — Redis
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — JWT signing
- `OPENAI_API_KEY` — OpenAI
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` — MinIO/S3
- `MEILISEARCH_HOST`, `MEILISEARCH_MASTER_KEY` — Search
- `INTEGRATION_ENCRYPTION_KEY` — Encrypts integration credentials
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `SENTRY_DSN`, `POSTHOG_API_KEY`, `BETTERSTACK_SOURCE_TOKEN` — Monitoring
- `API_PORT` (default 3001), `DASHBOARD_URL` — CORS

## Ports

API=3001, Dashboard=3000, PostgreSQL=5432, Redis=6379, MinIO=9000/9001, MeiliSearch=7700, MailHog=8025(UI)/1025(SMTP)

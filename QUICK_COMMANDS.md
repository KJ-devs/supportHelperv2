# Quick Command Reference

**Most commonly used commands for Support Helper development.**

---

## 🚀 Getting Started (First Time)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis, MinIO)
pnpm docker:up

# 3. Run database migrations
pnpm db:migrate

# 4. Seed test data
pnpm db:seed

# 5. Build all packages
pnpm build

# 6. Build SDK with CDN bundle (for examples)
pnpm --filter @support-helper/sdk-web build:all

# 7. Start all services
pnpm dev
```

**API:** http://localhost:3001
**Dashboard:** http://localhost:3000
**API Docs:** http://localhost:3001/api/docs

**Test Credentials:**
- Email: `owner@test.local`
- Password: `password123`

---

## 💻 Daily Development

```bash
# Start everything
pnpm dev                          # Start API (3001) + Dashboard (3000)

# Or start individually
pnpm --filter @support-helper/api dev
pnpm --filter @support-helper/dashboard dev
pnpm --filter @support-helper/worker dev

# Build everything
pnpm build                        # Build all packages

# Build specific package
pnpm --filter @support-helper/sdk-web build
pnpm --filter @support-helper/api build

# Build SDK with CDN bundle (for browser examples)
pnpm --filter @support-helper/sdk-web build:all
```

---

## 🗄️ Database

```bash
# Create and run new migration
pnpm db:migrate

# Generate Prisma client (after schema changes)
pnpm db:generate

# Open Prisma Studio (GUI)
pnpm db:studio

# Seed database with test data
pnpm db:seed

# Reset database (drop + migrate + seed)
pnpm --filter @support-helper/api db:reset
```

---

## 🐳 Docker

```bash
# Start all infrastructure services
pnpm docker:up

# Stop all services
pnpm docker:down

# View logs
pnpm docker:logs

# Check status
pnpm docker:ps

# Restart services
pnpm docker:restart

# Clean everything (removes volumes!)
pnpm docker:clean
```

**Services:**
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `localhost:9000` (console: `localhost:9001`)
  - User: `minioadmin`
  - Password: `minioadmin`

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Test specific package
pnpm --filter @support-helper/api test
pnpm --filter @support-helper/sdk-web test

# E2E tests (API)
pnpm --filter @support-helper/api test:e2e

# Test examples (manual)
# 1. Build SDK: pnpm --filter @support-helper/sdk-web build:all
# 2. Start API: pnpm --filter @support-helper/api dev
# 3. Open: examples/test-sdk.html in browser
```

---

## 🔍 Code Quality

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Type check
pnpm --filter @support-helper/api type-check
pnpm --filter @support-helper/dashboard type-check
```

---

## 🛠️ Troubleshooting

```bash
# Clean build cache
pnpm clean

# Clean node_modules and reinstall
rm -rf node_modules
pnpm install

# Clean Turbo cache
rm -rf .turbo

# Reset Docker volumes (if DB issues)
pnpm docker:clean
pnpm docker:up
pnpm db:migrate
pnpm db:seed

# Check if ports are in use
# Windows:
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Linux/Mac:
lsof -i :3000
lsof -i :3001

# Kill process on port (Windows)
taskkill /PID <PID> /F

# Kill process on port (Linux/Mac)
kill -9 <PID>
```

---

## 📦 Working with Specific Packages

### API (NestJS)

```bash
cd apps/api

# Development
pnpm dev

# Build
pnpm build

# Test
pnpm test
pnpm test:e2e

# Database
pnpm db:migrate
pnpm db:generate
pnpm db:seed
pnpm db:studio
```

### Dashboard (Next.js)

```bash
cd apps/dashboard

# Development
pnpm dev

# Build
pnpm build

# Start production build
pnpm start

# Lint
pnpm lint
```

### SDK (Web)

```bash
cd packages/sdk-web

# Development mode
pnpm dev

# Build for npm (ESM + CJS)
pnpm build

# Build for CDN (IIFE)
pnpm build:cdn

# Build both
pnpm build:all

# Test
pnpm test

# Type check
pnpm type-check
```

---

## 🔐 Environment Variables

### Quick Setup

```bash
# Copy example to your local config
cp .env.example .env.local

# Edit with your values
nano .env.local  # or use your editor
```

### Essential Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/support_helper"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key-change-in-production"

# S3/MinIO
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="support-helper"

# OpenAI (optional for AI features)
OPENAI_API_KEY="sk-..."

# Ports
API_PORT=3001
DASHBOARD_PORT=3000
```

---

## 📊 Useful Queries

### Check database connection
```bash
psql postgresql://postgres:postgres@localhost:5432/support_helper -c "SELECT version();"
```

### Check Redis connection
```bash
redis-cli ping
```

### Check MinIO
```bash
curl http://localhost:9000/minio/health/live
```

---

## 🚨 Common Issues & Fixes

### Port already in use
```bash
# Find and kill process
# Windows: netstat -ano | findstr :3001
# Linux/Mac: lsof -i :3001
# Then kill the process
```

### Docker services not starting
```bash
pnpm docker:down
pnpm docker:clean
pnpm docker:up
```

### Prisma client out of sync
```bash
pnpm db:generate
```

### Build cache issues
```bash
pnpm clean
rm -rf .turbo
pnpm build
```

### SDK recording not working
```bash
# Make sure you built the CDN bundle
pnpm --filter @support-helper/sdk-web build:all

# Verify it exists
ls packages/sdk-web/dist/cdn/sdk.iife.js
```

---

## 🎯 Production Deployment

```bash
# Build all packages
pnpm build

# Run database migrations
pnpm db:migrate

# Start production API
cd apps/api
NODE_ENV=production pnpm start

# Start production Dashboard
cd apps/dashboard
NODE_ENV=production pnpm start
```

**Note:** See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed production setup.

---

## 📚 More Help

- **Full Documentation:** [README.md](README.md)
- **Quick Start:** [QUICKSTART.md](QUICKSTART.md)
- **API Reference:** [docs/API.md](docs/API.md)
- **SDK Guide:** [docs/SDK.md](docs/SDK.md)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Testing:** [docs/TESTING.md](docs/TESTING.md)
- **Examples:** [examples/README.md](examples/README.md)

---

**Made with ❤️ by the Support Helper Team**

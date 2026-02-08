# 🚀 Quick Start Guide

**Get Support Helper running in 5 minutes!**

> This guide will help you set up and run the complete Support Helper platform locally.

---

## 📋 Prerequisites

Before starting, ensure you have:

| Tool | Required Version | Check Command |
|------|-----------------|---------------|
| **Node.js** | >= 20.0.0 | `node --version` |
| **pnpm** | >= 8.0.0 | `pnpm --version` |
| **Docker** | Latest | `docker --version` |
| **Docker Compose** | V2+ | `docker compose version` |
| **Git** | Any | `git --version` |

### Install Prerequisites (if needed)

<details>
<summary><strong>🖥️ Windows</strong></summary>

```powershell
# Install Node.js (using winget)
winget install OpenJS.NodeJS.LTS

# Install pnpm
npm install -g pnpm

# Install Docker Desktop
winget install Docker.DockerDesktop
```

</details>

<details>
<summary><strong>🍎 macOS</strong></summary>

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@20

# Install pnpm
npm install -g pnpm

# Install Docker Desktop
brew install --cask docker
```

</details>

<details>
<summary><strong>🐧 Linux</strong></summary>

```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm

# Install Docker
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

</details>

---

## ⚡ 5-Minute Setup

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-org/support-helper.git
cd support-helper

# Install dependencies
pnpm install
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env.local
```

The default settings work out of the box for local development.

### Step 3: Start Infrastructure

```bash
# Start all Docker services (PostgreSQL, Redis, MinIO, Meilisearch)
pnpm docker:up
```

Wait for all services to be healthy (takes ~30 seconds).

### Step 4: Setup Database

```bash
# Run database migrations
pnpm db:migrate

# Seed with test data
pnpm db:seed
```

### Step 5: Launch! 🎉

```bash
# Start all services in development mode
pnpm dev
```

---

## 🌐 Access the Platform

| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | admin@example.com / password123 |
| **API** | http://localhost:3001 | - |
| **API Docs (Swagger)** | http://localhost:3001/api/docs | - |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin |
| **Meilisearch** | http://localhost:7700 | - |
| **Mailhog (Email)** | http://localhost:8025 | - |

---

## ✅ Verify Everything Works

### 1. Check API Health

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

### 2. Login to Dashboard

1. Open http://localhost:3000
2. Login with: `admin@example.com` / `password123`
3. You should see the dashboard with sample tickets

### 3. Test SDK Integration

```html
<!-- Add to any HTML file -->
<script type="module">
  import { SupportHelper } from 'http://localhost:3001/sdk/support-helper.js';
  
  const sdk = new SupportHelper({
    sdkKey: 'sk_test_demo_key_12345',
    apiUrl: 'http://localhost:3001/api'
  });
  
  console.log('SDK loaded!', sdk);
</script>
```

---

## 📁 Project Structure Overview

```
support-helper/
├── apps/
│   ├── api/          # 🔧 NestJS Backend (port 3001)
│   ├── web/          # 🖥️ Next.js Dashboard (port 3000)
│   ├── dashboard/    # 📊 Admin Dashboard
│   └── worker/       # ⚙️ Background Jobs (BullMQ)
├── packages/
│   ├── sdk-web/      # 📦 Web SDK
│   ├── shared/       # 🔗 Shared Types
│   └── database/     # 💾 DB Utilities
├── docs/             # 📚 Documentation
└── docker/           # 🐳 Docker Configs
```

---

## 🔧 Common Commands

### Development

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all packages
pnpm lint             # Lint all code
pnpm format           # Format with Prettier
pnpm type-check       # TypeScript check
```

### Database

```bash
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed test data
pnpm db:studio        # Open Prisma Studio
pnpm db:generate      # Regenerate Prisma Client
```

### Docker

```bash
pnpm docker:up        # Start infrastructure
pnpm docker:down      # Stop infrastructure
pnpm docker:logs      # View logs
pnpm docker:clean     # Remove volumes & restart
```

### Testing

```bash
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:e2e         # E2E tests only
pnpm test:coverage    # With coverage report
```

---

## ❗ Troubleshooting

<details>
<summary><strong>🔴 Port already in use</strong></summary>

```bash
# Find process using port
# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000,3001,5432,6379,9000

# Linux/macOS
lsof -i :3000 -i :3001 -i :5432 -i :6379 -i :9000
```

**Default Ports:**
- Dashboard: 3000
- API: 3001
- PostgreSQL: 5432
- Redis: 6379
- MinIO: 9000 / 9001

</details>

<details>
<summary><strong>🔴 Docker containers not starting</strong></summary>

```bash
# Remove all and restart
pnpm docker:down
docker volume prune -f
pnpm docker:up

# Check logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

</details>

<details>
<summary><strong>🔴 Database connection error</strong></summary>

```bash
# Ensure PostgreSQL is running
docker-compose ps postgres

# Check DATABASE_URL in .env.local
# Should be: postgresql://support:support123@localhost:5432/support_helper

# Reset database
pnpm db:migrate reset
pnpm db:seed
```

</details>

<details>
<summary><strong>🔴 Prisma client error</strong></summary>

```bash
pnpm db:generate
```

</details>

<details>
<summary><strong>🔴 "Module not found" errors</strong></summary>

```bash
# Clean install
pnpm clean
pnpm install
pnpm build
```

</details>

---

## 🚀 What's Next?

| Goal | Resource |
|------|----------|
| Understand the architecture | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Deploy to production | [DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Integrate the SDK | [SDK.md](docs/SDK.md) |
| Contribute code | [CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| API Reference | [API.md](docs/API.md) |
| Testing Guide | [TESTING.md](docs/TESTING.md) |

---

## 💬 Need Help?

| Channel | Link |
|---------|------|
| 📖 Full Documentation | [docs/](docs/) |
| 🐛 Bug Reports | [GitHub Issues](https://github.com/your-org/support-helper/issues) |
| 💡 Feature Requests | [GitHub Discussions](https://github.com/your-org/support-helper/discussions) |
| 💬 Community | [Discord](https://discord.gg/support-helper) |

---

<div align="center">

**Happy coding! 🎉**

Built with ❤️ by the Support Helper Team

</div>

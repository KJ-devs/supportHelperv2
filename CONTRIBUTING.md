# Contributing to Support Helper

Thank you for your interest in contributing to Support Helper! We love receiving contributions from the community and want to make the process as easy as possible.

## Quick Links

- [Report a Bug](https://github.com/KJ-devs/supportHelperv2/issues/new?labels=bug&template=bug_report.md)
- [Request a Feature](https://github.com/KJ-devs/supportHelperv2/issues/new?labels=feature&template=feature_request.md)
- [Join the Discussion](https://github.com/KJ-devs/supportHelperv2/discussions)
- [Good First Issues](https://github.com/KJ-devs/supportHelperv2/labels/good%20first%20issue)

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Git**

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/supportHelperv2.git
cd supportHelperv2

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local

# 4. Start infrastructure (PostgreSQL, Redis, MinIO, Meilisearch, MailHog)
pnpm docker:up

# 5. Setup database
pnpm db:migrate
pnpm db:seed

# 6. Start development
pnpm dev
```

The dashboard is at http://localhost:3000 — login with `owner@test.local` / `password123`.

## How to Contribute

### Find an Issue

- Browse [**good first issue**](https://github.com/KJ-devs/supportHelperv2/labels/good%20first%20issue) for beginner-friendly tasks
- Check [**help wanted**](https://github.com/KJ-devs/supportHelperv2/labels/help%20wanted) for issues needing community help
- Comment on an issue to let us know you're working on it

### Development Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/api/my-feature
   ```

   Branch format: `type/scope/description` (e.g., `fix/dashboard/chart-mobile`)

2. **Make your changes** — focus on one thing per PR

3. **Run checks** before committing:

   ```bash
   pnpm build                                              # Must pass with 0 errors
   pnpm lint                                               # Code style
   pnpm --filter @support-helper/api test -- --maxWorkers=2  # API tests
   pnpm --filter @support-helper/dashboard test              # Dashboard tests
   ```

   > **Important:** Never run `pnpm test` globally — it launches all suites in parallel and exhausts RAM. Always test one package at a time.

4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat(api): add pagination to tickets endpoint
   fix(dashboard): correct chart rendering on mobile
   docs(readme): update installation instructions
   ```

5. **Push and open a PR** against `main`

### Pull Request Checklist

- [ ] Code builds successfully (`pnpm build`)
- [ ] Tests pass for affected packages
- [ ] Linting passes (`pnpm lint`)
- [ ] Changes are documented if needed
- [ ] PR title follows conventional commit format: `type(scope): description`

## Project Structure

```
apps/
  api/           # NestJS backend (port 3001)
  dashboard/     # Next.js 14 dashboard (port 3000)
  web/           # Public website (port 3002)
  worker/        # BullMQ background jobs
packages/
  sdk-web/       # Web SDK (npm + CDN)
  shared/        # Shared TypeScript types
  database/      # Database utilities
```

### Test Frameworks

| Package         | Framework  | File pattern    |
| --------------- | ---------- | --------------- |
| API, Worker     | Jest       | `*.spec.ts`     |
| Dashboard       | Vitest     | `*.test.ts`     |
| Dashboard (e2e) | Playwright | `e2e/*.spec.ts` |

## Code Style

- TypeScript strict mode — avoid `any`
- `async/await` over raw promises
- NestJS: decorators, DI via constructor, DTOs with `class-validator`
- React: functional components, TanStack Query for server state, Zustand for client state
- File naming: `kebab-case.ts` for files, `PascalCase.tsx` for components

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility for mistakes and learn from them

## Questions?

Open a [Discussion](https://github.com/KJ-devs/supportHelperv2/discussions) — we're happy to help!

Thank you for contributing!

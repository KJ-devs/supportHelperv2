---
paths:
  - "**/*"
---

# Regles de commits

- Commits atomiques : un commit = un changement logique
- **YOU MUST** utiliser le format : `type(scope): description courte`
  - `feat(scope): description` — nouvelle feature
  - `fix(scope): description` — correction de bug
  - `refactor(scope): description` — refactoring sans changement de comportement
  - `test(scope): description` — ajout ou modification de tests
  - `docs(scope): description` — documentation
  - `chore(scope): description` — maintenance, config
  - `perf(scope): description` — amelioration de performance
  - `ci(scope): description` — CI/CD
- Le **scope** identifie le package ou domaine concerne :
  - `(api)` — apps/api
  - `(dashboard)` — apps/dashboard
  - `(worker)` — apps/worker
  - `(sdk)` — packages/sdk-web
  - `(shared)` — packages/shared
  - `(db)` — schema Prisma, migrations
  - `(auth)` — authentification
  - `(ci)` — CI/CD, GitHub Actions
  - `(docker)` — Docker, infrastructure
  - `(claude)` — configuration Claude Code
- Exemples concrets :
  - `feat(api): add pagination to tickets endpoint`
  - `fix(dashboard): correct chart rendering on mobile`
  - `refactor(worker): extract video analysis into service`
  - `test(sdk): add e2e tests for recording flow`
  - `chore(docker): update PostgreSQL to v16`
- **Branches** au format : `type/scope/description-courte`
  - `feat/api/ticket-pagination`
  - `fix/dashboard/chart-mobile`
- **PR** au meme format que les commits : `type(scope): description`
- Ne jamais committer de fichiers .env, secrets, ou credentials

# Equipe Agentique — Support Helper Platform

> Ce fichier documente les agents du projet, leurs roles, et les regles d'orchestration.
> Consulte-le avant de deleguer du travail.

## Agents core (toujours presents)

### `forge` (skill: `/forge`)

**Role** : Tech Lead — orchestre les agents, decompose les US, gere les feedback loops
**Toujours present** : oui (orchestrateur principal)
**Responsabilites** :

- Analyser et decomposer les features en taches atomiques
- Decider du routing : subagents (delegation) vs agent team (parallele)
- Valider les outputs de chaque agent avant acceptation
- Gerer les conflits et escalations

### `qa-engineer`

**Role** : Quality gate — TDD/BDD, tests, validation
**Toujours present** : oui (intervient en premier ET en dernier)
**Responsabilites** :

- Ecrire les tests AVANT l'implementation (RED phase)
- Valider que les tests passent apres implementation (GREEN phase)
- Jest (API/Worker), Vitest (Dashboard), Playwright (e2e)
- Reproduire les bugs avec des tests avant correction

### `security-auditor`

**Role** : Revue securite (read-only)
**Quand l'utiliser** : US touchant auth, permissions, encryption, SDK keys, multi-tenant
**Responsabilites** :

- Audit OWASP Top 10
- Verification des tenant boundaries
- Detection de secrets hardcodes
- Rapport structure : critiques + suggestions

---

## Agents specialises

| Agent              | Domaine                                          | Fichiers owns                                   | Model  |
| ------------------ | ------------------------------------------------ | ----------------------------------------------- | ------ |
| `backend-dev`      | NestJS API, Prisma, auth, workers                | `apps/api/src/**`, `apps/worker/src/**`         | sonnet |
| `frontend-dev`     | Next.js 14 Dashboard, App Router, TanStack       | `apps/dashboard/**`                             | sonnet |
| `sdk-dev`          | Web SDK, Web Components, MediaRecorder           | `packages/sdk-web/**`                           | sonnet |
| `dba`              | PostgreSQL, Prisma schema, migrations, pgvector  | `apps/api/prisma/**`, `packages/database/**`    | sonnet |
| `qa-engineer`      | TDD/BDD, Jest/Vitest/Playwright                  | `**/*.spec.ts`, `**/*.test.ts`, `**/test/**`    | sonnet |
| `ai-engineer`      | OpenAI/Anthropic, agent pipeline, video analysis | `apps/api/src/ai/**`, `apps/worker/src/**` (AI) | sonnet |
| `devops`           | Docker, Turborepo, pnpm workspaces               | `docker/**`, `docker-compose.*`, `turbo.json`   | sonnet |
| `web-dev`          | Next.js 15 public web app                        | `apps/web/**`                                   | sonnet |
| `security-auditor` | OWASP, auth/authz audit (read-only)              | cross-cutting                                   | sonnet |
| `doc-writer`       | API docs, guides, README                         | `docs/**`, `*.md`                               | haiku  |

---

## Regles d'equipe

1. **qa-engineer** intervient TOUJOURS en premier (RED) et en dernier (GREEN)
2. **security-auditor** est obligatoire pour les US touchant : auth, encryption, SDK keys, multi-tenant
3. Au moins un agent de developpement (\*-dev) est TOUJOURS present
4. **forge** evalue le resultat de chaque agent avant de passer au suivant
5. **Pas d'edition concurrente** du meme fichier — serialiser si deux agents en ont besoin

## Pipeline d'execution standard

```
[qa-engineer RED]  → Tests qui echouent (comportement attendu)
[dba]              → Migration si schema change
[*-dev]            → Implementation (GREEN — faire passer les tests)
[qa-engineer]      → Verification GREEN + non-regression
[security-auditor] → Revue securite (si applicable)
[stabilizer]       → Build + tests + lint (quality gate finale)
```

## Orchestration : Subagents vs Agent Teams

| Critere                                    | Subagents | Agent Team |
| ------------------------------------------ | --------- | ---------- |
| 1-3 taches independantes                   | oui       |            |
| Pipeline sequentiel                        | oui       |            |
| Travail rapide et focalise                 | oui       |            |
| 3+ streams paralleles                      |           | oui        |
| Cross-layer feature (front+back+tests)     |           | oui        |
| Investigation avec hypotheses concurrentes |           | oui        |

## Types d'agents

| Categorie      | Pattern              | Role                                 |
| -------------- | -------------------- | ------------------------------------ |
| Planification  | `dba`, `ai-engineer` | Analyse et plan avant implementation |
| Developpement  | `*-dev`              | Implementation du code               |
| Test           | `qa-engineer`        | Ecriture et execution des tests      |
| Securite       | `security-auditor`   | Revue de code (read-only)            |
| Documentation  | `doc-writer`         | Mise a jour des docs                 |
| Infrastructure | `devops`             | Docker, CI/CD, build                 |

## Communication inter-agents

- Les agents ne lisent PAS le contexte brut des autres agents
- Le partage se fait via : summaries de taches, messages (mailbox), fichiers commites
- Chaque agent a sa memoire persistante dans `.claude/agent-memory/<name>/`
- Les subagents ne peuvent PAS spawner d'autres subagents

## Escalation

- Agent bloque → Forge reassigne ou debloque
- Conflit d'architecture → Forge tranche
- Probleme de securite → delegation immediate a `security-auditor`
- Agent team teammate bloque → message direct ou remplacement
- Resultat insuffisant → resume l'agent avec feedback ou re-delegue

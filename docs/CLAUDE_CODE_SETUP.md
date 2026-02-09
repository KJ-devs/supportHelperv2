# Configuration Claude Code — Forge & Agents

> Comment fonctionne le dossier `.claude/` dans ce projet et comment l'utiliser efficacement.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Structure du dossier `.claude/`](#structure-du-dossier-claude)
- [system.md — Le cerveau de Forge](#systemmd--le-cerveau-de-forge)
- [Les Subagents (agents spécialisés)](#les-subagents-agents-spécialisés)
- [Les Agent Teams (équipes parallèles)](#les-agent-teams-équipes-parallèles)
- [Les Commandes (`/forge`)](#les-commandes-forge)
- [La Mémoire Persistante](#la-mémoire-persistante)
- [Les Permissions](#les-permissions)
- [Comment utiliser tout ça](#comment-utiliser-tout-ça)
- [Schéma d'architecture](#schéma-darchitecture)

---

## Vue d'ensemble

Le dossier `.claude/` configure **Claude Code** (l'agent IA dans le terminal) pour fonctionner comme un **Tech Lead virtuel** appelé **Forge**. Au lieu d'un seul assistant qui fait tout, Forge orchestre une **équipe de 9 agents spécialisés**, chacun expert dans son domaine.

**Principe clé** : tu décris ce que tu veux, Forge décompose le travail, le distribue aux bons agents, et te livre le résultat assemblé.

---

## Structure du dossier `.claude/`

```
.claude/
├── system.md                    # Prompt système de Forge (le chef d'orchestre)
├── settings.local.json          # Permissions et variables d'environnement
├── agents/                      # Définitions des 9 agents spécialisés
│   ├── backend-dev.md
│   ├── frontend-dev.md
│   ├── sdk-dev.md
│   ├── dba.md
│   ├── qa-engineer.md
│   ├── devops.md
│   ├── ai-engineer.md
│   ├── security-auditor.md
│   └── doc-writer.md
├── commands/                    # Commandes slash personnalisées
│   └── forge.md                 # /forge — lance l'orchestration complète
└── agent-memory/                # Mémoire persistante par agent
    ├── backend-dev/
    │   └── MEMORY.md
    ├── qa-engineer/
    │   └── MEMORY.md
    └── security-auditor/
        └── MEMORY.md
```

---

## system.md — Le cerveau de Forge

Le fichier `system.md` est le **prompt système principal**. Il définit le comportement de Forge quand tu utilises Claude Code. Voici ce qu'il fait :

### Rôle
Forge est un **Tech Lead orchestrateur**. Il ne code pas directement — il analyse, planifie, dispatch et review.

### Workflow automatique

Quand tu décris une tâche, Forge suit ce pipeline :

```
1. ANALYSE     →  Décompose en épics + tâches atomiques
2. ROUTE       →  Subagents (petit) ou Agent Team (gros)
3. DISPATCH    →  Envoie chaque tâche au bon spécialiste
4. PARALLÉLISE →  Lance les tâches indépendantes en même temps
5. REVIEW      →  Vérifie chaque output avant d'accepter
6. LIVRE       →  Assemble et présente le résultat final
```

### Décision : Subagents vs Agent Team

| Critère | → Subagents | → Agent Team |
|---------|-------------|--------------|
| 1-3 tâches indépendantes | ✅ | |
| Pipeline séquentiel | ✅ | |
| Travail rapide et ciblé | ✅ | |
| 3+ streams de travail parallèles | | ✅ |
| Les agents doivent discuter entre eux | | ✅ |
| Feature multi-couche (front + back + tests) | | ✅ |

### Quality Gates

Avant de livrer, Forge vérifie :
1. Toutes les tâches marquées complétées
2. Pas d'erreurs TypeScript (`pnpm build` passe)
3. Les tests passent pour les modules affectés
4. Changements sécurité reviewés par `security-auditor`
5. Documentation mise à jour si l'API a changé

---

## Les Subagents (agents spécialisés)

Chaque fichier dans `.claude/agents/` définit un **agent spécialisé** avec :

- Un **nom** et une **description** (Claude route automatiquement selon la description)
- Un **modèle IA** (sonnet pour le code, haiku pour la doc)
- Des **outils autorisés** (Read, Write, Edit, Bash, Grep, Glob)
- Un **mode de permission** (`acceptEdits` pour coder, `plan` pour auditer)
- Une **mémoire persistante** qui survit entre les sessions

### Les 9 agents

| Agent | Modèle | Spécialité | Fichiers gérés |
|-------|--------|-----------|-----------------|
| **backend-dev** | sonnet | NestJS, Prisma, auth, REST API | `apps/api/`, `apps/worker/` |
| **frontend-dev** | sonnet | Next.js 14, React, Tailwind, TanStack Query | `apps/dashboard/` |
| **sdk-dev** | sonnet | Web Components, MediaRecorder, Vite | `packages/sdk-web/` |
| **dba** | sonnet | PostgreSQL, migrations, indexes, pgvector | `apps/api/prisma/`, `packages/database/` |
| **qa-engineer** | sonnet | Jest, Vitest, Playwright, testing | `**/*.spec.ts`, `**/test/` |
| **devops** | sonnet | Docker, Turborepo, pnpm, CI/CD | `docker/`, `turbo.json`, `.github/` |
| **ai-engineer** | sonnet | OpenAI, prompts, embeddings, RAG | `apps/api/src/ai/`, `apps/worker/` |
| **security-auditor** | sonnet | OWASP, audit sécurité, read-only | cross-cutting (lecture seule) |
| **doc-writer** | haiku | Documentation, API docs, guides | `docs/`, `*.md` |

### Isolation des contextes

Chaque agent a son **propre context window isolé**. Quand un agent finit son travail :
- Il retourne un **résumé** à Forge (pas son contexte brut)
- Il ne peut **pas** lire le contexte des autres agents
- Il ne peut **pas** spawner d'autres agents (limitation Claude Code)
- Les échanges de données se font uniquement via les résumés de tâches

### Ownership des fichiers

Chaque agent a un périmètre de fichiers strict. **Pas d'édits concurrents sur le même fichier** — si deux agents ont besoin du même fichier, Forge sérialise.

### Cas spécial : security-auditor

C'est le seul agent en **mode `plan`** (read-only). Il a accès à `Read, Grep, Glob, Bash` mais **pas** `Write` ni `Edit`. Il analyse le code, produit un rapport de vulnérabilités avec sévérité, et Forge délègue les corrections aux agents d'implémentation.

---

## Les Agent Teams (équipes parallèles)

Pour les **gros chantiers** (features multi-couches), Forge peut créer une **Agent Team** : plusieurs instances Claude Code qui tournent en parallèle.

### Activation

Le setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` dans `settings.local.json` active cette fonctionnalité expérimentale.

### Comment ça marche

```
Forge (Tech Lead)
  ├── Teammate 1 : Backend   → Instance Claude Code séparée
  ├── Teammate 2 : Frontend  → Instance Claude Code séparée
  ├── Teammate 3 : Tests     → Instance Claude Code séparée
  └── Teammate 4 : Docs      → Instance Claude Code séparée
```

Chaque teammate a :
- Son **propre context window**
- Une **task list partagée** (ils réclament et complètent des tâches)
- Une **mailbox** pour communiquer entre eux
- La possibilité de **se parler directement**

### Quand Forge utilise les Agent Teams

- La tâche a 3+ streams de travail parallèles
- Les agents ont besoin de discuter/challenger mutuellement
- Le travail couvre plusieurs couches (front + back + tests + docs)
- Recherche avec hypothèses concurrentes

### Exemple de création

```
Create an agent team with 4 teammates:
- Backend: implement the new ticket API endpoints in apps/api/
- Frontend: build the ticket detail page in apps/dashboard/
- Tests: write integration tests for the new API
- Docs: update API documentation in docs/
Require plan approval before implementation.
```

---

## Les Commandes (`/forge`)

Le fichier `.claude/commands/forge.md` définit la commande slash `/forge`. Quand tu tapes `/forge` dans Claude Code, ça active le mode orchestration complète.

Le prompt est en français et reprend le même workflow que `system.md` :
1. Analyse la demande
2. Décide du mode (subagents ou agent team)
3. Délègue aux spécialistes
4. Parallélise les tâches indépendantes
5. Review chaque output
6. Livre le résultat

### Format de statut

Forge affiche sa progression dans ce format :

```
🏗️ FORGE — [Feature Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Progression: [████░░░░] X% (N/M tâches)
🔧 Mode: Subagents | Agent Team

👥 Agents:
  backend-dev    🔄 working  API endpoints
  frontend-dev   🔄 working  Dashboard page
  dba            ✅ done      Migration
  qa-engineer    ⏳ blocked   En attente de backend-dev
```

---

## La Mémoire Persistante

Chaque agent qui a `memory: project` dans sa config accumule des connaissances dans `.claude/agent-memory/<agent-name>/MEMORY.md`.

### Ce qui y est stocké

- **Patterns architecturaux** découverts dans le code
- **Décisions techniques** prises pendant les sessions
- **Emplacements clés** (où sont les controllers, les guards, etc.)
- **Gotchas** et pièges du codebase
- **Conventions** spécifiques au projet

### Exemple concret

Le `backend-dev` a mémorisé :
- Que `GithubModule` est commenté dans `app.module.ts`
- Que `AuthModule` n'est PAS dans `src/modules/auth/` mais `src/auth/`
- Qu'il y a ~60 endpoints répartis sur 14 controllers
- Les patterns de guards (JWT vs SDK key)
- Les patterns de DTO (Zod vs class-validator selon le module)

Cette mémoire **survit entre les sessions**, donc l'agent n'a pas besoin de re-découvrir le codebase à chaque fois.

---

## Les Permissions

Le fichier `settings.local.json` contrôle ce que Claude Code peut faire **sans demander confirmation** :

### Commandes Bash autorisées

```json
"Bash(pnpm install:*)"        // Installer des dépendances
"Bash(pnpm build:*)"          // Builder le projet
"Bash(pnpm test:*)"           // Lancer les tests
"Bash(pnpm db:*)"             // Commandes base de données
"Bash(pnpm dev:*)"            // Lancer en mode dev
"Bash(pnpm clean:*)"          // Nettoyer le cache
"Bash(findstr:*)"             // Recherche Windows
"Bash(ls:*)"                  // Lister les fichiers
```

### Délégation aux agents autorisée

```json
"Task(backend-dev)"
"Task(frontend-dev)"
"Task(sdk-dev)"
"Task(dba)"
"Task(qa-engineer)"
"Task(devops)"
"Task(ai-engineer)"
"Task(security-auditor)"
"Task(doc-writer)"
```

### Variable d'environnement

```json
"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
```

Active la feature expérimentale des Agent Teams.

---

## Comment utiliser tout ça

### Usage basique — Parle normalement

```
"Ajoute un endpoint pour lister les feedbacks de classification"
```

Forge va automatiquement :
1. Décomposer (schema? endpoint? tests? docs?)
2. Déléguer au `dba` pour le schema, `backend-dev` pour l'endpoint, `qa-engineer` pour les tests
3. Te livrer le tout

### Usage avec `/forge`

```
/forge Implémente le système de notifications en temps réel avec WebSockets
```

Lance l'orchestration complète avec statut visuel.

### Délégation directe à un agent

```
Use the security-auditor subagent to audit the auth module
Use the dba subagent to optimize the ticket queries
```

### Lancer une team pour un gros chantier

```
Create an agent team to implement the new reporting dashboard:
- Backend: new analytics endpoints
- Frontend: dashboard charts and tables
- DBA: optimize aggregation queries
- Tests: full test coverage
```

---

## Schéma d'architecture

```
                         ┌─────────────────────┐
                         │     TOI (humain)     │
                         │  "Je veux feature X" │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        🔥 FORGE (system.md)   │
                    │  Tech Lead — Analyse & Route  │
                    └───────────────┬───────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  ▼                 ▼                  ▼
         ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
         │  Mode Simple │ │  Mode Team   │  │   /forge     │
         │  Subagents   │ │  Agent Teams │  │   command    │
         └──────┬───────┘ └──────┬───────┘  └──────────────┘
                │                │
    ┌───────────┼────────┐      │
    ▼           ▼        ▼      ▼
┌────────┐ ┌────────┐ ┌────┐ ┌──────────────────────────────┐
│backend │ │frontend│ │dba │ │  Teammate 1  ←mailbox→  T2   │
│  -dev  │ │  -dev  │ │    │ │  Teammate 3  ←mailbox→  T4   │
└───┬────┘ └───┬────┘ └─┬──┘ │     (shared task list)       │
    │          │         │    └──────────────────────────────┘
    ▼          ▼         ▼
┌─────────────────────────────┐
│    agent-memory/ (MEMORY.md)│
│  Savoir persistant par agent│
└─────────────────────────────┘
```

---

## Résumé rapide

| Concept | Fichier(s) | Rôle |
|---------|-----------|------|
| **Forge** | `system.md` | Tech Lead qui orchestre tout |
| **Subagents** | `agents/*.md` | 9 spécialistes avec contexte isolé |
| **Agent Teams** | `settings.local.json` (env) | Instances parallèles pour gros chantiers |
| **Commandes** | `commands/forge.md` | `/forge` pour orchestration complète |
| **Mémoire** | `agent-memory/*/MEMORY.md` | Connaissances persistantes par agent |
| **Permissions** | `settings.local.json` | Commandes autorisées sans confirmation |

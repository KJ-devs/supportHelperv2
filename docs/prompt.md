# Mission : Stabilisation complète du monorepo supportHelperv2

## Objectif

Amener le monorepo a un etat stable v1.0 : tous les packages buildent, les tests passent, toutes les features existantes fonctionnent. Zero erreur de build, zero `any`, zero `@ts-ignore`.

---

## Architecture du projet

```
supportHelperv2/
  packages/shared/        → Types TypeScript partages (@support-helper/shared)
  packages/database/      → Utilitaires DB (@support-helper/database)
  packages/sdk-web/       → Web SDK widget (@support-helper/sdk-web)
  apps/api/               → Backend NestJS + Prisma (@support-helper/api)
  apps/worker/            → Worker BullMQ (@support-helper/worker)
  apps/dashboard/         → Dashboard Next.js 14 (@support-helper/dashboard)
  apps/web/               → App web Next.js 15 (@repo/web) ← ATTENTION au nom
```

**Infra Docker** : PostgreSQL, Redis, MinIO, MeiliSearch

---

## Graphe de dependances des phases

```
Phase 1: Audit (lecture seule)
    │
    ▼
Phase 2: Fondations (workspace config)
    │
    ├───────────────────┐
    ▼                   ▼
Phase 3: shared     Phase 4: database        ← PARALLELE
    │                   │
    ├─────────┬─────────┘
    │         │
    ▼         ▼
Phase 5:  Phase 6:                           ← PARALLELE
sdk-web   api
    │         │
    │         ▼
    │      Phase 7: worker                   ← SEQUENTIEL (partage Prisma avec api)
    │         │
    ├─────────┤
    │         │
    ▼         ▼
Phase 8:  Phase 9:                           ← PARALLELE
dashboard web
    │         │
    └────┬────┘
         ▼
Phase 10: Validation finale
```

---

## Regles anti-hallucination obligatoires

### Regle 1 : TOUJOURS lire avant d'ecrire
- AVANT de modifier un fichier, lis-le ENTIEREMENT.
- AVANT de corriger une erreur, reproduis-la d'abord avec la commande de build/test.
- NE JAMAIS inventer du code base sur des suppositions.

### Regle 2 : TOUJOURS valider apres chaque changement
- Apres CHAQUE modification, execute la commande de validation correspondante.
- Ne passe JAMAIS a l'etape suivante si l'etape actuelle ne compile pas.

### Regle 3 : Un probleme a la fois
- Corrige UN seul probleme, valide, puis passe au suivant.
- Ne fais JAMAIS de changements en masse sans validation intermediaire.

### Regle 4 : Verification des imports
- Avant d'importer un module, verifie qu'il existe.
- Avant d'utiliser un package, verifie qu'il est dans le `package.json` du workspace.
- Avant d'utiliser un type Prisma, verifie qu'il existe dans `apps/api/prisma/schema.prisma`.

### Regle 5 : Jamais de suppositions
- Execute `ls`, `cat`, `find`, `grep` pour verifier la structure reelle.
- Ne suppose JAMAIS qu'un fichier existe.

---

## Contraintes absolues

1. **TypeScript strict** : aucun `any`, aucun `@ts-ignore`, aucun `@ts-nocheck`
2. **Pas de dependances fantomes** : chaque import = dependance declaree dans le package.json du workspace
3. **Multi-tenant obligatoire** : chaque query Prisma de l'API et du Worker DOIT filtrer par `tenantId`
4. **Pas de code mort** : supprimer imports/variables inutilises
5. **Pas de secrets en dur** : utiliser les variables d'environnement
6. **Guards sur chaque endpoint** : `JwtAuthGuard` (dashboard) ou `SdkKeyGuard` (SDK)
7. **DTOs valides** : chaque input passe par un DTO avec `class-validator`

---

## Mapping Agents → Phases

| Phase | Description | Agent | subagent_type |
|-------|-------------|-------|---------------|
| 1 | Audit complet | DevOps | `devops` |
| 2 | Fondations workspace | DevOps | `devops` |
| 3 | packages/shared | Backend-Dev | `backend-dev` |
| 4 | packages/database | DBA | `dba` |
| 5 | packages/sdk-web | SDK-Dev | `sdk-dev` |
| 6 | apps/api | Backend-Dev | `backend-dev` |
| 7 | apps/worker | Backend-Dev | `backend-dev` |
| 8 | apps/dashboard | Frontend-Dev | `frontend-dev` |
| 9 | apps/web | Frontend-Dev | `frontend-dev` |
| 10 | Validation finale | QA-Engineer | `qa-engineer` |

**Transverse** : `security-auditor` pour audit multi-tenant/guards apres Phase 6.

---

## Les 10 phases

### Phase 1 : Audit complet
- **Guide detaille** : `docs/audit/01-audit.md`
- **Agent** : `devops`
- **Input** : Aucun
- **Output** : Fichier `AUDIT.md` a la racine du projet
- **Succes** : Rapport complet avec TOUTES les erreurs par workspace
- **Resume** : Lire chaque package.json, tsconfig, tenter `pnpm build` workspace par workspace, capturer toutes les erreurs. Ne rien corriger.

### Phase 2 : Fondations
- **Guide detaille** : `docs/audit/02-fix-foundations.md`
- **Agent** : `devops`
- **Depend de** : Phase 1
- **Input** : `AUDIT.md`
- **Output** : `pnpm install` passe sans erreur
- **Succes** : Tous les workspaces se reconnaissent
- **Resume** : Corriger pnpm-workspace.yaml, tsconfig racine, package.json de chaque workspace (noms, exports, dependances internes en `workspace:*`).

### Phase 3 : packages/shared
- **Guide detaille** : `docs/audit/03-fix-shared.md`
- **Agent** : `backend-dev`
- **Depend de** : Phase 2
- **Output** : `pnpm --filter @support-helper/shared build` exit 0
- **Succes** : Tous les types partages compilent en strict mode
- **Resume** : C'est la BASE de tout. Verifier chaque type/interface/enum exporte, corriger le strict mode, builder.

### Phase 4 : packages/database
- **Guide detaille** : `docs/audit/04-fix-database.md`
- **Agent** : `dba`
- **Depend de** : Phase 2
- **Parallelisable avec** : Phase 3
- **Output** : `pnpm --filter @support-helper/database build` exit 0
- **Resume** : Verifier la coherence avec le schema Prisma, generer le client, builder.

### Phase 5 : packages/sdk-web
- **Guide detaille** : `docs/audit/05-fix-sdk-web.md`
- **Agent** : `sdk-dev`
- **Depend de** : Phase 3 (shared)
- **Parallelisable avec** : Phase 6
- **Output** : Build npm OK + **`dist/cdn/` existe** (build CDN IIFE)
- **Succes** : `pnpm --filter @support-helper/sdk-web build` ET `build:cdn` passent
- **Resume** : Verifier config Vite (library mode), imports, builder npm ET CDN. Le CDN est CRITIQUE — sans lui le widget ne rend pas.

### Phase 6 : apps/api
- **Guide detaille** : `docs/audit/06-fix-api.md`
- **Agent** : `backend-dev`
- **Depend de** : Phase 3 (shared) + Phase 4 (database)
- **Parallelisable avec** : Phase 5
- **Output** : `pnpm --filter @support-helper/api build` exit 0
- **Succes** : Build OK + audit securite (multi-tenant, guards, DTOs)
- **Resume** : Generer Prisma client, verifier tous les modules NestJS, corriger les erreurs de types, valider la securite (tenantId sur chaque query, guards sur chaque endpoint, DTOs sur chaque input).

### Phase 7 : apps/worker
- **Guide detaille** : `docs/audit/07-fix-worker.md`
- **Agent** : `backend-dev`
- **Depend de** : Phase 6 (partage le schema Prisma avec l'API)
- **Output** : `pnpm --filter @support-helper/worker build` exit 0
- **Resume** : Le worker utilise `../api/prisma/schema.prisma` (PAS sa propre copie). Verifier le lien Prisma, les dependances specifiques (BullMQ, FFmpeg, Tesseract, OpenAI), builder.

### Phase 8 : apps/dashboard
- **Guide detaille** : `docs/audit/08-fix-dashboard.md`
- **Agent** : `frontend-dev`
- **Depend de** : Phase 3 (shared)
- **Parallelisable avec** : Phase 9
- **Output** : `pnpm --filter @support-helper/dashboard build` exit 0
- **Resume** : Next.js **14** App Router. Verifier `transpilePackages`, `'use client'`, imports cross-workspace. Vitest pour les tests.

### Phase 9 : apps/web
- **Guide detaille** : `docs/audit/09-fix-web.md`
- **Agent** : `frontend-dev`
- **Depend de** : Phase 3 (shared)
- **Parallelisable avec** : Phase 8
- **Output** : `pnpm --filter @repo/web build` exit 0 ← ATTENTION c'est `@repo/web`
- **Resume** : Next.js **15** + React 19 + Turbopack. Port 3002. Memes patterns que le dashboard mais avec les specificites Next 15. Vitest + Playwright pour les tests.

### Phase 10 : Validation finale
- **Guide detaille** : `docs/audit/10-validation-finale.md`
- **Agent** : `qa-engineer`
- **Depend de** : Toutes les phases precedentes
- **Output** : `AUDIT.md` mis a jour avec le tableau final
- **Succes** : Les 3 commandes passent sans erreur :

```bash
pnpm build     # Build global
pnpm lint      # Lint global
pnpm test      # Tests globaux
```

---

## Plan d'execution optimal (avec parallelisation)

```
Etape 1 (sequentiel):
  → Phase 1: Audit
  → Phase 2: Fondations

Etape 2 (parallele):
  → Phase 3: shared    } en meme temps
  → Phase 4: database  }

Etape 3 (parallele):
  → Phase 5: sdk-web   } en meme temps
  → Phase 6: api       }

Etape 4 (sequentiel):
  → Phase 7: worker (depend de api pour Prisma)

Etape 5 (parallele):
  → Phase 8: dashboard  } en meme temps
  → Phase 9: web        }

Etape 6 (sequentiel):
  → Phase 10: Validation finale
```

**Gain estime** : ~40% plus rapide que l'execution purement sequentielle.

---

## Lancement

### Option 1 : Forge (auto-pilot)

```
/forge Execute le plan de stabilisation defini dans docs/prompt.md.
Lis docs/prompt.md pour le plan complet et docs/audit/*.md pour les guides detailles de chaque phase.
Commence par Phase 1 (audit), puis corrige chaque workspace dans l'ordre des dependances.
Parallelise les phases independantes (3+4, 5+6, 8+9).
Chaque agent doit lire le fichier docs/audit/XX-*.md correspondant a sa phase AVANT de commencer.
```

### Option 2 : Phase par phase (manuel)

```
Lis docs/audit/01-audit.md et execute la Phase 1 : audit complet du monorepo. Cree AUDIT.md a la racine.
```

```
Lis AUDIT.md et docs/audit/02-fix-foundations.md, execute la Phase 2 : corriger les fondations du workspace.
```

```
Lis AUDIT.md et docs/audit/03-fix-shared.md, execute la Phase 3 : corriger packages/shared.
```

```
Lis AUDIT.md et docs/audit/04-fix-database.md, execute la Phase 4 : corriger packages/database.
```

```
Lis AUDIT.md et docs/audit/05-fix-sdk-web.md, execute la Phase 5 : corriger packages/sdk-web (npm + CDN).
```

```
Lis AUDIT.md et docs/audit/06-fix-api.md, execute la Phase 6 : corriger apps/api + audit securite.
```

```
Lis AUDIT.md et docs/audit/07-fix-worker.md, execute la Phase 7 : corriger apps/worker.
```

```
Lis AUDIT.md et docs/audit/08-fix-dashboard.md, execute la Phase 8 : corriger apps/dashboard (Next.js 14).
```

```
Lis AUDIT.md et docs/audit/09-fix-web.md, execute la Phase 9 : corriger apps/web (Next.js 15, @repo/web).
```

```
Lis docs/audit/10-validation-finale.md, execute la Phase 10 : validation finale (build + lint + test).
```

### Option 3 : Relancer une phase specifique

```
La Phase [N] a echoue. Lis AUDIT.md et docs/audit/[NN]-*.md, corrige les problemes restants et valide.
```

---

## Points de vigilance critiques

| Piege | Detail |
|-------|--------|
| SDK CDN build manquant | `pnpm --filter @support-helper/sdk-web build:cdn` est SEPARE du build npm. Sans lui, le widget `<support-helper>` ne rend pas. Verifier que `dist/cdn/` existe. |
| Package name de apps/web | C'est `@repo/web`, PAS `@support-helper/web`. Utiliser `pnpm --filter @repo/web build`. |
| Worker Prisma | Le worker n'a PAS son propre schema. Il utilise `../api/prisma/schema.prisma`. |
| Dashboard = Next.js 14 | Ne PAS confondre avec apps/web qui est Next.js 15. |
| Multi-tenant | CHAQUE query Prisma doit filtrer par `tenantId`. Une query sans = faille de securite. |
| Test frameworks | API/Worker = Jest (`*.spec.ts`), Dashboard/Web = Vitest (`*.test.ts`). Ne pas melanger. |
| Ports | API=3001, Dashboard=3000, Web=3002. Verifier les CORS. |
| Prisma generate | Toujours `pnpm db:generate` apres modification du schema. Genere pour API ET Worker. |

---

## Format de rapport par phase

Chaque phase doit produire un rapport dans ce format :

```
## Phase N : [Nom du workspace] — TERMINEE / EN COURS

### Problemes trouves et corriges :
1. [Description] → [Correction appliquee]

### Fichiers modifies :
- path/to/file.ts : [description du changement]

### Validation :
- `commande executee` → Succes / Erreur (detail)
```

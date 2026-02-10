# Phase 2 — Corriger les fondations

## Prérequis

Lis `AUDIT.md` pour connaître l'état actuel du projet et les erreurs identifiées.

## Objectif

Corriger la configuration du monorepo pour que `pnpm install` fonctionne sans erreur et que les workspaces se reconnaissent entre eux.

## Étapes

### 1. pnpm-workspace.yaml

```bash
cat pnpm-workspace.yaml
```

Doit contenir exactement :
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 2. Package.json racine

```bash
cat package.json
```

Vérifie :
- Les scripts `build`, `dev`, `lint`, `test` existent
- `db:generate` pointe vers Prisma generate
- Les devDependencies globales (turbo, typescript) sont présentes

### 3. TSConfig racine

```bash
cat tsconfig.json
```

Vérifie :
- `compilerOptions.strict` est `true`
- Les `paths` pour `@support-helper/*` sont définis si utilisés
- Les `references` vers chaque workspace sont déclarés (si project references)

### 4. Chaque workspace — package.json

Pour chaque workspace, vérifie et corrige :

```bash
# Lire
cat packages/shared/package.json
```

- `name` : `@support-helper/shared` (etc.)
- `main` / `types` / `exports` : pointent vers des fichiers existants (vérifier avec `ls`)
- `build` script : existe et utilise le bon outil (tsc, vite, nest build, next build)
- Dépendances internes : `"@support-helper/shared": "workspace:*"` (pas de version fixe)
- Pas de dépendance dupliquée entre `dependencies` et `devDependencies`

### 5. Chaque workspace — tsconfig.json

Pour chaque workspace, vérifie et corrige :
- Hérite du tsconfig racine ou d'un tsconfig base
- `outDir` est défini
- `rootDir` ou `include` sont corrects
- Les `paths` ou `references` pour les dépendances internes sont cohérents

### 6. Installation propre

```bash
pnpm install 2>&1 | tail -20
```

Si erreur de lockfile :
```bash
rm pnpm-lock.yaml
pnpm install 2>&1 | tail -20
```

## Validation

```bash
# Doit passer sans erreur
pnpm install 2>&1 | tail -10
echo "Exit code: $?"
```

## Rapport

```
## Phase 2 : Fondations — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Validation :
- `pnpm install` → ✅/❌
```

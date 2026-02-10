# Phase 4 — Corriger packages/database

## Prérequis

- Phase 3 terminée : `pnpm --filter @support-helper/shared build` ✅
- Lis `AUDIT.md` section `packages/database`

## Étapes

### 1. Lire la structure

```bash
cat packages/database/package.json
cat packages/database/tsconfig.json
ls -la packages/database/src/
find packages/database/src/ -name "*.ts" | sort
```

### 2. Lire le schéma Prisma

```bash
cat apps/api/prisma/schema.prisma
```

Note les modèles et enums utilisés. Le package database doit être cohérent avec ce schéma.

### 3. Vérifier les imports du client Prisma

```bash
# Comment le client Prisma est importé dans ce package
grep -r "prisma" packages/database/src/ --include="*.ts" | head -20

# Comment les autres workspaces importent de @support-helper/database
grep -r "from '@support-helper/database'" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20
```

### 4. Générer le client Prisma (si nécessaire)

```bash
cd apps/api && npx prisma generate 2>&1 | tail -10
cd ../..
```

### 5. Corriger et builder

```bash
pnpm --filter @support-helper/database build 2>&1
echo "Exit code: $?"
```

## Validation

```bash
pnpm --filter @support-helper/database build 2>&1 | tail -10
```

## Rapport

```
## Phase 4 : packages/database — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Validation :
- `pnpm --filter @support-helper/database build` → ✅/❌
```

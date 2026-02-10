# Phase 6 — Corriger apps/api

## Prérequis

- Phases 3-5 terminées : shared ✅, database ✅, sdk-web ✅
- Lis `AUDIT.md` section `apps/api`

## Contexte

L'API est le cœur du système. C'est un backend NestJS avec :
- Auth JWT + SDK key
- Multi-tenant (CHAQUE query filtre par tenantId)
- Prisma 5 pour la DB
- Modules : Auth, Tenant, Ticket, Media, Application, User, Classification, Feedback, Integration, Agent

## Étapes

### 1. Générer le client Prisma

```bash
cd apps/api
npx prisma generate 2>&1 | tail -10
cd ../..
```

Si erreur → lire le schéma Prisma et corriger.

### 2. Lire la structure

```bash
cat apps/api/package.json
cat apps/api/tsconfig.json
cat apps/api/tsconfig.build.json 2>/dev/null
cat apps/api/nest-cli.json 2>/dev/null
ls -la apps/api/src/
find apps/api/src/ -name "*.module.ts" | sort
find apps/api/src/ -name "*.controller.ts" | sort
find apps/api/src/ -name "*.service.ts" | sort
find apps/api/src/ -name "*.guard.ts" | sort
find apps/api/src/ -name "*.dto.ts" | sort
```

### 3. Vérifier les imports cross-workspace

```bash
grep -r "from '@support-helper/" apps/api/src/ --include="*.ts" | head -20
```

Chaque import de `@support-helper/shared` et `@support-helper/database` doit correspondre à un export réel.

### 4. Vérifier le module principal

```bash
cat apps/api/src/app.module.ts
cat apps/api/src/main.ts
```

### 5. Builder

```bash
pnpm --filter @support-helper/api build 2>&1
echo "Exit code: $?"
```

Si erreurs → les corriger UNE PAR UNE :
1. Lire le fichier qui a l'erreur : `cat apps/api/src/[chemin]`
2. Comprendre l'erreur
3. Corriger
4. Re-builder
5. Passer à l'erreur suivante

### 6. Vérifications de sécurité (après build OK)

#### Multi-tenant : chaque query Prisma filtre par tenantId
```bash
# Chercher les appels Prisma sans tenantId
grep -rn "prisma\." apps/api/src/ --include="*.ts" | grep -v "tenantId" | grep -v "import" | grep -v "//" | head -20
```

#### Guards : chaque endpoint est protégé
```bash
# Chercher les controllers sans @UseGuards
for f in $(find apps/api/src/ -name "*.controller.ts"); do
  if ! grep -q "UseGuards\|@Public" "$f"; then
    echo "⚠️ PAS DE GUARD : $f"
  fi
done
```

#### DTOs : chaque input est validé
```bash
# Chercher les endpoints qui prennent @Body sans DTO typé
grep -rn "@Body()" apps/api/src/ --include="*.ts" | head -10
```

### 7. Tests (si disponibles)

```bash
pnpm --filter @support-helper/api test 2>&1 | tail -30
```

## Validation

```bash
pnpm --filter @support-helper/api build 2>&1 | tail -10
```

## Rapport

```
## Phase 6 : apps/api — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Audit sécurité :
- Multi-tenant : ✅/❌ [détails]
- Guards : ✅/❌ [détails]
- DTOs : ✅/❌ [détails]

### Validation :
- `pnpm --filter @support-helper/api build` → ✅/❌
- `pnpm --filter @support-helper/api test` → ✅/❌/⏭️ (skipped)
```

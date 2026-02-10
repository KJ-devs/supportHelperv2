# Phase 8 — Corriger apps/dashboard

## Prérequis

- Phases 3-7 terminées : tous les packages et apps/api ✅
- Lis `AUDIT.md` section `apps/dashboard`

## Contexte

Dashboard admin en **Next.js 14** App Router + TailwindCSS + TanStack Query + Zustand.
Authentification via `next-auth` + JWT. Communication temps réel via `socket.io-client`.

**Package name** : `@support-helper/dashboard`

Pages : login, signup, dashboard, tickets, ticket detail, analytics, integrations, applications, settings.

## Étapes

### 1. Lire la structure

```bash
cat apps/dashboard/package.json
cat apps/dashboard/tsconfig.json
cat apps/dashboard/next.config.mjs 2>/dev/null || cat apps/dashboard/next.config.js 2>/dev/null || cat apps/dashboard/next.config.ts 2>/dev/null
cat apps/dashboard/postcss.config.js 2>/dev/null
cat apps/dashboard/tailwind.config.ts 2>/dev/null || cat apps/dashboard/tailwind.config.js 2>/dev/null
ls -la apps/dashboard/app/ 2>/dev/null
```

### 2. Lister les pages et composants

```bash
find apps/dashboard/ -name "page.tsx" -not -path "*/node_modules/*" | sort
find apps/dashboard/ -name "layout.tsx" -not -path "*/node_modules/*" | sort
find apps/dashboard/ -path "*/components/*" -name "*.tsx" -not -path "*/node_modules/*" | sort | head -30
```

### 3. Vérifier les imports cross-workspace

```bash
grep -r "from '@support-helper/" apps/dashboard/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20
```

Chaque import de `@support-helper/shared` doit correspondre à un export réel du package shared.

### 4. Vérifier les 'use client' mal placés

```bash
# Fichiers avec 'use client' — vérifier qu'ils en ont vraiment besoin (hooks, state, events)
grep -rl "'use client'" apps/dashboard/ --include="*.tsx" | grep -v node_modules | head -20

# Fichiers qui utilisent des hooks SANS 'use client' — erreur probable
for f in $(find apps/dashboard/ -name "*.tsx" -not -path "*/node_modules/*"); do
  if grep -q "useState\|useEffect\|useRef\|useCallback\|useMemo\|useQuery" "$f"; then
    if ! grep -q "'use client'" "$f"; then
      echo "⚠️ HOOK sans 'use client' : $f"
    fi
  fi
done
```

### 5. Vérifier la config Next.js

La config doit :
- Gérer le transpile des packages internes (`@support-helper/*`) via `transpilePackages`
- Avoir les bons `images.domains` si images externes
- Pas de conflit App Router / Pages Router
- **Next.js 14** — ne pas utiliser de features Next.js 15+

```bash
cat apps/dashboard/next.config.mjs 2>/dev/null || cat apps/dashboard/next.config.js 2>/dev/null
```

### 6. Vérifier les appels API

```bash
# Comment le dashboard communique avec l'API
grep -r "axios\|fetch\|api\." apps/dashboard/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20

# Vérifier l'URL de base de l'API
grep -r "localhost:3001\|API_URL\|NEXT_PUBLIC_API" apps/dashboard/ --include="*.ts" --include="*.tsx" --include="*.env*" | grep -v node_modules | head -10
```

### 7. Builder

```bash
pnpm --filter @support-helper/dashboard build 2>&1
echo "Exit code: $?"
```

Next.js produit souvent BEAUCOUP d'erreurs. Les traiter par fichier :
1. Lire l'erreur
2. `cat` le fichier concerné
3. Corriger
4. Re-builder
5. Passer à la suivante

### 8. Erreurs communes Next.js 14 App Router

- `Cannot use import statement outside a module` → vérifier `transpilePackages` dans next.config
- `'X' is not exported from '@support-helper/shared'` → vérifier que l'export existe dans packages/shared
- `Attempted import error: 'useState' is not exported from 'react'` → ajouter `'use client'` en haut du fichier
- `Error: Unsupported Server Component type` → le composant utilise du state/hooks sans `'use client'`
- `Module not found: Can't resolve '@support-helper/shared'` → vérifier `transpilePackages` dans next.config

### 9. Tests (si disponibles)

```bash
pnpm --filter @support-helper/dashboard test 2>&1 | tail -30
```

Note : le dashboard utilise **Vitest** (pas Jest).

## Validation

```bash
pnpm --filter @support-helper/dashboard build 2>&1 | tail -20
```

## Rapport

```
## Phase 8 : apps/dashboard — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Validation :
- `pnpm --filter @support-helper/dashboard build` → ✅/❌
- `pnpm --filter @support-helper/dashboard test` → ✅/❌/⏭️ (skipped)
```

# Phase 9 — Corriger apps/web

## Prérequis

- Phases 3-8 terminées
- Lis `AUDIT.md` section `apps/web`

## Contexte

App web publique en **Next.js 15** App Router + Turbopack + React 19 + TailwindCSS.
TanStack Query + Table + Form, Zustand pour le state. Radix UI + Lucide icons.
TipTap pour le rich text. Recharts pour les graphiques analytics.

**Package name** : `@repo/web` (attention, PAS `@support-helper/web`)
**Port** : 3002

Ce frontend contient :
- Pages d'auth (login, register)
- Gestion de tickets (liste, détail, création, filtres avancés, bulk actions)
- Lecture vidéo enrichie
- Analytics (charts, tendances)
- Timeline de ticket
- Sidebar navigation

## Étapes

### 1. Lire la structure

```bash
cat apps/web/package.json
cat apps/web/tsconfig.json
cat apps/web/next.config.mjs 2>/dev/null || cat apps/web/next.config.js 2>/dev/null || cat apps/web/next.config.ts 2>/dev/null
cat apps/web/postcss.config.js 2>/dev/null || cat apps/web/postcss.config.mjs 2>/dev/null
cat apps/web/tailwind.config.ts 2>/dev/null || cat apps/web/tailwind.config.js 2>/dev/null
ls -la apps/web/src/ 2>/dev/null || ls -la apps/web/app/ 2>/dev/null
```

### 2. Lister les pages et composants

```bash
find apps/web/ -name "page.tsx" -not -path "*/node_modules/*" | sort
find apps/web/ -name "layout.tsx" -not -path "*/node_modules/*" | sort
find apps/web/ -path "*/components/*" -name "*.tsx" -not -path "*/node_modules/*" | sort | head -40
find apps/web/ -path "*/hooks/*" -name "*.ts" -not -path "*/node_modules/*" | sort
```

### 3. Vérifier les imports cross-workspace

```bash
# Attention : le package name est @repo/web, pas @support-helper/web
grep -r "from '@support-helper/" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20
grep -r "from '@repo/" apps/web/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20
```

### 4. Vérifier les 'use client'

```bash
grep -rl "'use client'" apps/web/ --include="*.tsx" | grep -v node_modules | head -20

# Fichiers avec hooks mais sans 'use client'
for f in $(find apps/web/ -name "*.tsx" -not -path "*/node_modules/*"); do
  if grep -q "useState\|useEffect\|useRef\|useCallback\|useMemo\|useQuery" "$f"; then
    if ! grep -q "'use client'" "$f"; then
      echo "⚠️ HOOK sans 'use client' : $f"
    fi
  fi
done
```

### 5. Vérifier la config Next.js 15

```bash
cat apps/web/next.config.mjs 2>/dev/null || cat apps/web/next.config.js 2>/dev/null
```

Spécificités Next.js 15 :
- `transpilePackages` pour les packages internes
- Turbopack activé via `--turbopack` dans le script dev
- React 19 : vérifier compatibilité des dépendances

### 6. Vérifier les appels API

```bash
# Comment le web app communique avec l'API
grep -r "axios\|fetch\|api" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20

# URL de l'API
grep -r "localhost:3001\|API_URL\|NEXT_PUBLIC_API" apps/web/ --include="*.ts" --include="*.tsx" --include="*.env*" | grep -v node_modules | head -10
```

### 7. Builder

```bash
# ATTENTION : le filter utilise @repo/web, pas @support-helper/web
pnpm --filter @repo/web build 2>&1
echo "Exit code: $?"
```

Mêmes patterns de résolution que le dashboard (Next.js App Router).

### 8. Erreurs communes Next.js 15 + React 19

- Mêmes erreurs que Next.js 14 (voir Phase 8)
- En plus : `React.FC` déprécié en React 19 — utiliser des types inline
- `useFormStatus` / `useActionState` — API spécifiques à React 19
- Server Actions syntax changes en Next.js 15

### 9. Tests

```bash
# Tests unitaires (Vitest)
pnpm --filter @repo/web test 2>&1 | tail -30

# Tests E2E (Playwright) — seulement si le dev server tourne
# pnpm --filter @repo/web test:e2e 2>&1 | tail -30
```

Note : le web utilise **Vitest** (unitaire) et **Playwright** (E2E).

## Validation

```bash
pnpm --filter @repo/web build 2>&1 | tail -20
```

## Rapport

```
## Phase 9 : apps/web — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Validation :
- `pnpm --filter @repo/web build` → ✅/❌
- `pnpm --filter @repo/web test` → ✅/❌/⏭️ (skipped)
```

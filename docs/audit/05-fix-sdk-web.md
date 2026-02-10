# Phase 5 — Corriger packages/sdk-web

## Prérequis

- Phases 3-4 terminées : shared ✅, database ✅
- Lis `AUDIT.md` section `packages/sdk-web`

## Contexte

Le SDK Web est un Web Component `<support-helper>` buildé avec Vite en library mode. Il produit :
- Un bundle ESM/CJS pour npm
- Un bundle IIFE pour CDN (`<script>` tag)
- Des wrappers React et Vue

## Étapes

### 1. Lire la structure

```bash
cat packages/sdk-web/package.json
cat packages/sdk-web/tsconfig.json
cat packages/sdk-web/vite.config.ts 2>/dev/null || cat packages/sdk-web/vite.config.js 2>/dev/null
ls -la packages/sdk-web/src/
find packages/sdk-web/src/ -name "*.ts" -o -name "*.tsx" | sort
```

### 2. Vérifier la config Vite

Le `vite.config` doit avoir :
- `build.lib` configuré (entry, name, formats)
- `build.rollupOptions.external` pour les dépendances externes
- Le custom element ne doit PAS dépendre de React/Vue en runtime

### 3. Vérifier les imports

```bash
# Imports de @support-helper/shared
grep -r "from '@support-helper/shared'" packages/sdk-web/src/ --include="*.ts" | head -10

# Imports externes
grep -r "from '" packages/sdk-web/src/ --include="*.ts" | grep -v "from '\." | grep -v "@support-helper" | head -10
```

Chaque import externe doit être dans le package.json.

### 4. Corriger et builder (npm)

```bash
pnpm --filter @support-helper/sdk-web build 2>&1
echo "Exit code: $?"
```

### 5. Builder le CDN (IIFE) — CRITIQUE

Le widget `<support-helper>` ne fonctionne PAS sans le build CDN. C'est un bundle IIFE séparé pour l'intégration via `<script>` tag.

```bash
pnpm --filter @support-helper/sdk-web build:cdn 2>&1
echo "Exit code: $?"
```

### 6. Vérifier les outputs

```bash
# Build npm (ESM/CJS)
ls -la packages/sdk-web/dist/ 2>/dev/null

# Build CDN (IIFE) — DOIT exister
ls -la packages/sdk-web/dist/cdn/ 2>/dev/null || echo "⚠️ CRITIQUE : dist/cdn/ manquant — le widget ne fonctionnera pas"
```

Les deux dossiers `dist/` et `dist/cdn/` DOIVENT exister après le build.

## Validation

```bash
pnpm --filter @support-helper/sdk-web build 2>&1 | tail -10
pnpm --filter @support-helper/sdk-web build:cdn 2>&1 | tail -10

# Vérification finale
ls packages/sdk-web/dist/cdn/ 2>/dev/null && echo "✅ CDN build OK" || echo "❌ CDN build MANQUANT"
```

## Rapport

```
## Phase 5 : packages/sdk-web — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Validation :
- `pnpm --filter @support-helper/sdk-web build` → ✅/❌
- `pnpm --filter @support-helper/sdk-web build:cdn` → ✅/❌
- `dist/cdn/` existe → ✅/❌
```

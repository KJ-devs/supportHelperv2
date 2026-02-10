# Phase 3 — Corriger packages/shared

## Prérequis

- Phase 2 terminée : `pnpm install` fonctionne
- Lis `AUDIT.md` section `packages/shared`

## Contexte

`packages/shared` contient les types TypeScript partagés entre TOUS les workspaces. C'est la base de la pyramide. Si ce package ne build pas, rien d'autre ne marchera.

## Étapes

### 1. Lire la structure actuelle

```bash
cat packages/shared/package.json
cat packages/shared/tsconfig.json
ls -la packages/shared/src/
find packages/shared/src/ -name "*.ts" | sort
```

### 2. Lire chaque fichier source

```bash
# Lire TOUS les fichiers, pas juste les premiers
find packages/shared/src/ -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 3. Vérifier les exports

Le fichier `index.ts` (ou le `main` dans package.json) doit exporter tout ce qui est utilisé par les autres workspaces.

```bash
# Trouver ce que les autres workspaces importent de @support-helper/shared
grep -r "from '@support-helper/shared'" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -30
```

Chaque import trouvé DOIT correspondre à un export dans packages/shared.

### 4. Corriger les erreurs TypeScript

- Aucun `any` — remplacer par le type correct ou `unknown`
- Aucun `@ts-ignore`
- Tous les types doivent être valides en mode `strict`
- Les enums doivent correspondre aux enums Prisma si applicable

### 5. Vérifier package.json exports

```bash
cat packages/shared/package.json
```

Les champs `main`, `types`, et `exports` doivent pointer vers les fichiers générés par le build :
- Si build tsc : `dist/index.js` et `dist/index.d.ts`
- Vérifier que le `outDir` du tsconfig correspond

### 6. Builder et valider

```bash
pnpm --filter @support-helper/shared build 2>&1
echo "Exit code: $?"
```

Si erreur → lire l'erreur, corriger le fichier concerné, re-builder. Boucler jusqu'à succès.

### 7. Vérifier que le build a produit les fichiers attendus

```bash
ls -la packages/shared/dist/ 2>/dev/null || echo "Pas de dossier dist"
```

## Validation

```bash
pnpm --filter @support-helper/shared build 2>&1 | tail -10
# Doit afficher 0 erreur
```

## Rapport

```
## Phase 3 : packages/shared — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Exports vérifiés :
- [liste des types/interfaces/enums exportés]

### Validation :
- `pnpm --filter @support-helper/shared build` → ✅/❌
```

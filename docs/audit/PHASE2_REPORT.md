# Phase 2 : Fondations — ✅ COMPLÉTÉ

Date : 2026-02-10
Agent : DevOps

## Objectif

Corriger la configuration du monorepo pour que `pnpm install` fonctionne sans erreur et que les workspaces se reconnaissent entre eux.

## Problèmes corrigés

### 1. Dépendance dupliquée `passport-custom`

**Problème** : Le package `passport-custom` était déclaré à deux endroits :
- `package.json` racine (ligne 55)
- `apps/api/package.json` (ligne 56)

**Cause** : Ajout accidentel au root alors que seule l'API l'utilise.

**Solution** : Retiré du `package.json` racine. Le package reste uniquement dans `apps/api/package.json`.

**Fichier modifié** : `C:\Users\krebs\Documents\sphelper\supportHelperv2\package.json`

**Changement** :
```diff
   "packageManager": "pnpm@8.15.0",
-  "dependencies": {
-    "passport-custom": "^1.1.1"
-  }
+}
```

## Vérifications effectuées

### 1. pnpm-workspace.yaml
✅ **Conforme** - Configuration correcte :
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 2. package.json racine
✅ **Conforme** après correction :
- Scripts `build`, `dev`, `lint`, `test` : présents et fonctionnels
- Script `db:generate` : pointe vers Prisma generate (API + Worker)
- DevDependencies globales : turbo, typescript, prettier, rimraf
- ❌ **Corrigé** : `passport-custom` retiré des dependencies

### 3. tsconfig.base.json
✅ **Conforme** - Configuration stricte appropriée :
- `compilerOptions.strict: true`
- `target: ES2022`, `module: NodeNext`
- Options strictes activées : `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`

### 4. Workspaces - Noms de packages

| Workspace | Nom | Statut |
|-----------|-----|--------|
| packages/shared | `@support-helper/shared` | ✅ Correct |
| packages/database | `@support-helper/database` | ✅ Correct |
| packages/sdk-web | `@support-helper/sdk-web` | ✅ Correct |
| apps/api | `@support-helper/api` | ✅ Correct |
| apps/worker | `@support-helper/worker` | ✅ Correct |
| apps/dashboard | `@support-helper/dashboard` | ✅ Correct |
| apps/web | `@repo/web` | ⚠️ Incohérence (intentionnelle) |

**Note** : `@repo/web` utilise une convention différente, mais c'est le nom officiel selon CLAUDE.md et fonctionne correctement.

### 5. Workspaces - Dépendances internes

✅ **Toutes les dépendances internes utilisent `workspace:*`** :

| Workspace | Dépend de | Déclaration |
|-----------|-----------|-------------|
| sdk-web | shared | `"@support-helper/shared": "workspace:*"` ✅ |
| api | shared | `"@support-helper/shared": "workspace:*"` ✅ |
| worker | shared | `"@support-helper/shared": "workspace:*"` ✅ |
| dashboard | shared | `"@support-helper/shared": "workspace:*"` ✅ |
| web | shared | `"@support-helper/shared": "workspace:*"` ✅ |

Aucune dépendance interne avec version fixe détectée.

### 6. Workspaces - tsconfig.json

**Héritent du tsconfig.base.json** :
- ✅ `packages/shared` - Extends `../../tsconfig.base.json`
- ✅ `packages/database` - Extends `../../tsconfig.base.json`
- ✅ `packages/sdk-web` - Extends `../../tsconfig.base.json` (overrides pour bundler)
- ✅ `apps/dashboard` - Extends `../../tsconfig.base.json` (overrides pour Next.js)

**Configurations indépendantes (justifiées)** :
- ⚠️ `apps/api` - NestJS nécessite `experimentalDecorators`, `emitDecoratorMetadata`, `commonjs`
- ⚠️ `apps/worker` - NestJS + **strict: false** (identifié mais acceptable pour cette phase)
- ⚠️ `apps/web` - Next.js 15 avec configuration spécifique

**Justification** : Les apps NestJS et Next.js ont des besoins spécifiques incompatibles avec le tsconfig.base.json. Cette indépendance est normale et attendue.

### 7. Workspaces - Exports et structure

✅ **Tous les exports pointent vers des fichiers existants après build** :

| Workspace | Main | Types | Statut |
|-----------|------|-------|--------|
| shared | `./dist/index.js` | `./dist/index.d.ts` | ✅ Créés |
| database | `dist/index.js` | `dist/index.d.ts` | ✅ Créés |
| sdk-web | `dist/index.cjs.js` + ESM | `dist/index.d.ts` | ✅ Créés |

### 8. turbo.json
✅ **Conforme** - Pipeline bien configurée :
- `build` : dépend de `^build` (upstream first)
- `lint` : dépend de `^build`
- `test` : dépend de `build`
- `dev` : cache désactivé, persistent
- `db:*` : cache désactivé (correct)

## Validation

### Installation propre
```bash
pnpm install
```

✅ **Résultat** : Succès sans erreur
- Exit code : 0
- Temps : 2.1s (lockfile à jour)
- Warnings non bloquants : peer dependency `date-fns` dans apps/web (4.1.0 vs 2-3 attendu par react-day-picker)

### Build complet
```bash
pnpm build
```

✅ **Résultat** : Succès pour tous les workspaces (7/7)
- Temps total : 1m0.6s
- Tous les packages compilés sans erreur
- Fichiers dist générés correctement

**Détails par workspace** :
| Workspace | Build | Temps approximatif | Warnings |
|-----------|-------|-------------------|----------|
| shared | ✅ OK | ~3s | Aucun |
| database | ✅ OK | ~3s | Aucun |
| sdk-web | ✅ OK | ~9.8s | Vite CJS deprecated (non bloquant) |
| api | ✅ OK | ~10s | Aucun |
| worker | ✅ OK | ~10s | Aucun |
| dashboard | ✅ OK | ~15s | Sentry auth token manquant (non bloquant) |
| web | ✅ OK | ~15s | `<img>` au lieu de `<Image>` (non bloquant) |

## Fichiers modifiés

1. **C:\Users\krebs\Documents\sphelper\supportHelperv2\package.json**
   - Retiré `passport-custom` des dependencies racine

## Problèmes non résolus (hors scope Phase 2)

### À traiter en Phase 3+ :
1. **apps/worker** : `strict: false` désactive toutes les vérifications TypeScript strictes
   - Impact : Masque les erreurs potentielles
   - Phase recommandée : Phase 3 (Qualité du code)

2. **@repo/web** : Nom de package incohérent avec les autres workspaces
   - Impact : Confusion dans la convention de nommage
   - Phase recommandée : Phase 2 alternative OU Phase 3
   - **Note** : Selon CLAUDE.md, c'est le nom officiel. À valider avec l'équipe avant changement.

3. **date-fns** peer dependency warning dans apps/web
   - Impact : Warning non bloquant, fonctionnalité non affectée
   - Phase recommandée : Phase 3

4. **SDK CDN build manquant** (`dist/cdn/sdk.iife.js`)
   - Impact : Widget ne peut pas être utilisé via CDN
   - Phase recommandée : **Phase 1 (Bloqueurs)** - déjà identifié dans l'audit

## Recommandations

### Immédiat (Phase 1 - Bloqueurs)
1. Générer le build CDN du SDK : `pnpm --filter @support-helper/sdk-web build:cdn`
2. Corriger les 7 tests cassés dans `apps/api/test/unit/services/auth.service.spec.ts`

### Court terme (Phase 3 - Qualité)
1. Activer `strict: true` dans `apps/worker/tsconfig.json` et corriger les erreurs révélées
2. Mettre à jour `date-fns` à v3.x dans apps/web pour résoudre le peer dependency warning
3. Décider officiellement si `@repo/web` doit être renommé en `@support-helper/web`

### Optionnel
1. Ajouter `build:cdn` à la pipeline Turbo pour garantir sa génération automatique
2. Documenter pourquoi les apps NestJS n'étendent pas le tsconfig.base.json

## Conclusion

### ✅ Phase 2 : COMPLÉTÉE AVEC SUCCÈS

**Résumé** :
- ✅ `pnpm install` fonctionne sans erreur
- ✅ Tous les workspaces se reconnaissent entre eux
- ✅ Les dépendances internes utilisent `workspace:*`
- ✅ `pnpm build` réussit pour tous les workspaces
- ✅ 1 problème corrigé : dépendance dupliquée `passport-custom`

**Prochaine étape recommandée** : Phase 1 (Bloqueurs) - Générer le build CDN du SDK et corriger les tests API.

---

**Agent DevOps** - Rapport généré automatiquement le 2026-02-10

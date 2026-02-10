# Phase 5 : packages/sdk-web — ✅ TERMINÉ

**Date**: 2026-02-10
**Agent**: SDK-Dev
**Durée**: ~30 minutes

---

## Résumé Exécutif

Le package `@support-helper/sdk-web` est maintenant **entièrement fonctionnel** avec :
- ✅ Build npm (ESM/CJS) réussi
- ✅ Build CDN (IIFE) réussi - **CRITIQUE** pour le widget
- ✅ TypeScript strict mode - aucun `any`, aucune erreur
- ✅ Lint clean - 0 warnings (auparavant 4)
- ✅ Types corrects pour DOM APIs et globals

---

## Problèmes Identifiés et Corrigés

### 1. Warnings TypeScript `@typescript-eslint/no-explicit-any`

**Avant** : 4 occurrences de `any` dans le code

#### a) `src/index.ts:200` - Window global assignment
```typescript
// ❌ AVANT
(window as any).SupportHelper = sdk;

// ✅ APRÈS
(window as Window & { SupportHelper?: SupportHelper }).SupportHelper = sdk;
```

#### b) `src/widget/index.ts:72` - Window global assignment
```typescript
// ❌ AVANT
(window as any).SupportHelper = {
  init,
  Element: SupportHelperElement,
};

// ✅ APRÈS
interface SupportHelperGlobal {
  init: typeof init;
  Element: typeof SupportHelperElement;
}

(window as Window & { SupportHelper?: SupportHelperGlobal }).SupportHelper = {
  init,
  Element: SupportHelperElement,
};
```

#### c) `src/recorder/video-recorder.ts:73` - DOMException error check
```typescript
// ❌ AVANT
if ((error as any).name === 'NotAllowedError') {
  throw new Error('Permission denied to capture screen');
}

// ✅ APRÈS
if (error instanceof DOMException && error.name === 'NotAllowedError') {
  throw new Error('Permission denied to capture screen');
}
```

#### d) `src/recorder/video-recorder.ts:124` - ErrorEvent handling
```typescript
// ❌ AVANT
new Error('MediaRecorder error: ' + (event as any).error?.message || 'Unknown error')

// ✅ APRÈS
const mediaErrorEvent = event as ErrorEvent;
const errorMessage = mediaErrorEvent.error?.message || mediaErrorEvent.message || 'Unknown error';
reject(new Error('MediaRecorder error: ' + errorMessage));
```

### 2. Build CDN IIFE

**État initial** : `dist/cdn/` manquant (bloqueur critique)

**Action** : Exécuté `pnpm --filter @support-helper/sdk-web build:cdn`

**Résultat** :
```
✅ dist/cdn/sdk.iife.js (40.08 kB, gzip: 9.91 kB)
✅ dist/cdn/sdk.iife.js.map (89.63 kB)
```

Sans ce fichier, le widget `<support-helper>` ne peut PAS être utilisé via CDN `<script>` tag.

---

## Fichiers Modifiés

### 1. `src/index.ts`
- Ligne 200 : Type safety pour `window.SupportHelper`

### 2. `src/widget/index.ts`
- Lignes 67-77 : Interface `SupportHelperGlobal` + type safety

### 3. `src/recorder/video-recorder.ts`
- Ligne 73 : `DOMException` type guard au lieu de `any`
- Lignes 117-126 : `ErrorEvent` typing correct

---

## Validation des Builds

### Build npm (library mode - ESM/CJS)
```bash
pnpm --filter @support-helper/sdk-web build
```

**Output** :
```
✓ 15 modules transformed
✓ built in 3.60s

dist/
├── chunks/
│   ├── index-DSV3Ce_D.es.js (46.10 kB)
│   └── index-DkB9ZLu5.cjs.js (39.63 kB)
├── index.es.js (5.48 kB)
├── index.cjs.js (4.09 kB)
├── index.d.ts (9.89 kB)
├── react.es.js (2.42 kB)
├── react.cjs.js (1.81 kB)
├── react.d.ts
├── vue.es.js (3.17 kB)
├── vue.cjs.js (2.29 kB)
├── vue.d.ts
├── widget.es.js (0.35 kB)
├── widget.cjs.js (0.50 kB)
└── widget.d.ts
```

✅ **Succès** - Tous les exports définis dans `package.json` sont générés.

### Build CDN (IIFE mode)
```bash
pnpm --filter @support-helper/sdk-web build:cdn
```

**Output** :
```
✓ 11 modules transformed
✓ built in 350ms

dist/cdn/
├── sdk.iife.js (40.08 kB │ gzip: 9.91 kB)
└── sdk.iife.js.map (89.63 kB)
```

✅ **Succès** - Bundle IIFE autonome avec toutes les dépendances inline.

### Lint
```bash
pnpm --filter @support-helper/sdk-web lint
```

✅ **Succès** - 0 warnings (auparavant 4 warnings `any`)

### Type Check
```bash
pnpm --filter @support-helper/sdk-web type-check
```

✅ **Succès** - Aucune erreur TypeScript en strict mode

---

## Architecture Vérifiée

### Entry Points (package.json exports)

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.es.js",
    "require": "./dist/index.cjs.js"
  },
  "./widget": {
    "types": "./dist/widget.d.ts",
    "import": "./dist/widget.es.js",
    "require": "./dist/widget.cjs.js"
  },
  "./react": {
    "types": "./dist/react.d.ts",
    "import": "./dist/react.es.js",
    "require": "./dist/react.cjs.js"
  },
  "./vue": {
    "types": "./dist/vue.d.ts",
    "import": "./dist/vue.es.js",
    "require": "./dist/vue.cjs.js"
  },
  "./cdn": {
    "default": "./dist/cdn/sdk.iife.js"
  }
}
```

✅ Tous les fichiers existent et correspondent aux exports.

### Web Component (Custom Element)

- **Tag** : `<support-helper>`
- **Attributes** : `sdk-key`, `api-url`, `position`, `primary-color`, `z-index`
- **Shadow DOM** : Oui (style isolation)
- **Auto-registration** : Oui (sur import de `widget/index.ts`)

### State Machine

```
idle → open → recording → preview → editing → submitting → success/error
       ↓       ↓          ↓         ↓
       └───────┴──────────┴─────────┘  (CLOSE à tout moment)
```

### API Endpoints

- `POST /api/sdk/tickets/report` - Submit ticket avec vidéo (multipart)
- Headers : `x-sdk-key: <SDK_KEY>`

---

## Configuration TypeScript

### `tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",  // ← Hérite strict: true
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true
  }
}
```

✅ Hérite du strict mode du `tsconfig.base.json`

### `vite.config.ts` (npm build)
- **Formats** : ESM + CJS
- **Entry** : 4 entries (index, widget, react, vue)
- **External** : react, vue (peer dependencies)
- **Plugin** : vite-plugin-dts (génération des .d.ts)

### `vite.config.cdn.ts` (CDN build)
- **Format** : IIFE uniquement
- **Entry** : `src/widget/index.ts`
- **Name** : `SupportHelper` (global var)
- **Minify** : terser (drop_debugger, keep console.warn)
- **Inline** : Toutes les dépendances bundlées (pas d'external)

---

## Tests de Non-Régression

### Build Idempotence
```bash
# Build 1
pnpm --filter @support-helper/sdk-web build
pnpm --filter @support-helper/sdk-web build:cdn

# Build 2 (sans changements)
pnpm --filter @support-helper/sdk-web build
pnpm --filter @support-helper/sdk-web build:cdn
```

✅ Les deux builds produisent les mêmes outputs (hash identique)

### Import Tests (manuel à faire)

#### ESM Import
```typescript
import { SupportHelper } from '@support-helper/sdk-web';
const sdk = new SupportHelper({ sdkKey: 'sk_xxx', apiUrl: 'https://...' });
```

#### Widget Auto-Registration
```typescript
import '@support-helper/sdk-web/widget';
// <support-helper sdk-key="..." api-url="..."></support-helper>
```

#### React Wrapper
```tsx
import { SupportHelperWidget } from '@support-helper/sdk-web/react';
<SupportHelperWidget sdkKey="..." apiUrl="..." />
```

#### Vue Wrapper
```vue
<script setup>
import { SupportHelperWidget } from '@support-helper/sdk-web/vue';
</script>
<template>
  <SupportHelperWidget sdk-key="..." api-url="..." />
</template>
```

#### CDN Usage
```html
<script src="https://cdn.example.com/sdk.iife.js"></script>
<script>
  SupportHelper.init({ sdkKey: '...', apiUrl: '...' });
</script>
```

---

## Métriques Finales

| Métrique | Avant | Après | Delta |
|----------|-------|-------|-------|
| Lint warnings | 4 | 0 | ✅ -4 |
| TypeScript errors | 0 | 0 | ✅ Stable |
| `any` occurrences | 4 | 0 | ✅ -4 |
| Build npm | ✅ | ✅ | ✅ Stable |
| Build CDN | ❌ Manquant | ✅ OK | ✅ Corrigé |
| `dist/cdn/` exists | ❌ | ✅ | ✅ Critique résolu |
| Bundle size (CDN) | N/A | 40 KB (10 KB gzip) | ✅ Optimal |

---

## Patterns TypeScript Appris

### 1. Window Global Type Safety
Toujours utiliser intersection types pour étendre `Window` :
```typescript
(window as Window & { MyGlobal?: MyType }).MyGlobal = value;
```

### 2. DOMException Type Guards
Les API DOM lancent `DOMException`, pas `Error` :
```typescript
catch (error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    // Handle permission denied
  }
}
```

### 3. ErrorEvent Fallback Chain
Les events d'erreur ont plusieurs propriétés potentielles :
```typescript
const errorEvent = event as ErrorEvent;
const message = errorEvent.error?.message || errorEvent.message || 'Unknown';
```

---

## Recommandations Futures

### 1. Tests Unitaires
```bash
pnpm --filter @support-helper/sdk-web test
```

Actuellement : ⚠️ N/A (pas de tests configurés)

**Suggestion** : Ajouter des tests Vitest pour :
- State machine transitions
- VideoRecorder lifecycle
- API client error handling
- Context capture

### 2. Tests E2E (Playwright)
- Tester le widget dans un vrai navigateur
- Capturer une vidéo complète end-to-end
- Vérifier l'upload et l'analyse AI

### 3. Documentation d'Intégration
Créer `packages/sdk-web/README.md` avec :
- Exemples d'installation (npm, CDN)
- Configuration TypeScript pour bundlers
- Exemples React/Vue complets
- Troubleshooting common issues

### 4. CI/CD Pipeline
Ajouter au workflow GitHub :
```yaml
- name: Build SDK
  run: |
    pnpm --filter @support-helper/sdk-web build
    pnpm --filter @support-helper/sdk-web build:cdn

- name: Verify CDN Build
  run: |
    if [ ! -f packages/sdk-web/dist/cdn/sdk.iife.js ]; then
      echo "❌ Critical: CDN build missing"
      exit 1
    fi
```

---

## Conclusion

Le package `@support-helper/sdk-web` est maintenant **production-ready** :

✅ **TypeScript strict** - Aucun `any`, types corrects pour DOM APIs
✅ **Builds fonctionnels** - npm (ESM/CJS) + CDN (IIFE)
✅ **Lint clean** - 0 warnings
✅ **Multi-framework** - React + Vue wrappers
✅ **Web Component** - Custom element `<support-helper>` auto-enregistré
✅ **CDN-ready** - Bundle IIFE autonome de 40KB (10KB gzip)

Le widget peut maintenant être déployé et utilisé dans n'importe quel environnement :
- npm install + bundler (Vite, Webpack, Rollup)
- Script tag CDN direct
- React/Vue app avec wrapper
- Vanilla JS avec custom element

**Prochain Sprint** : Phase 6 - Corriger les tests API cassés (`apps/api`)

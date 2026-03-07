---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
---

# Pratiques de test — TDD/BDD

## Philosophie : Test-First

Avant d'ecrire du code, ecrire les tests qui decrivent le comportement attendu.
Les tests sont des specs vivantes, pas une validation apres coup.

## Cycle TDD obligatoire

```
RED   → Ecrire le test qui echoue (comportement non implemente)
GREEN → Implementer le minimum pour faire passer le test
REFACTOR → Ameliorer le code sans casser les tests
```

Commit conventions par phase :

- `test(scope): add failing tests for [feature] [RED]` — apres la phase RED
- `feat(scope): implement [feature] [GREEN]` — apres la phase GREEN
- `refactor(scope): clean up [feature]` — apres refactoring

## Approche BDD — Scenarios d'abord

Avant d'implementer une feature ou un fix, decrire les scenarios de test :

- Lister les cas nominaux, les cas limites, et les cas d'erreur
- Utiliser le format Given/When/Then pour structurer les scenarios
- Les scenarios servent de spec vivante et guident l'implementation

Exemple :

```
// Scenario: Creer une relation entre tickets
// Given un ticket source et un ticket target dans le meme tenant
// When je cree une relation de type "duplicate"
// Then la relation est creee avec createdBy="manual"
// And la relation apparait dans les deux directions

// Scenario: Empecher les doublons de relations
// Given une relation duplicate existe deja entre ticket A et B
// When je cree la meme relation
// Then une erreur unique constraint est levee
```

Couverture obligatoire par feature :

1. Cas nominal (happy path — donnees valides)
2. Cas limites (inputs vides, null, valeurs extremes)
3. Cas d'erreur (inputs invalides, acces non autorise, erreurs reseau)

## Backend — TDD avec Jest

Pour les services et la logique metier :

1. Ecrire le test qui decrit le comportement attendu
2. Verifier qu'il echoue (red)
3. Implementer le minimum pour le faire passer (green)
4. Refactorer si necessaire (refactor)

Ne pas appliquer TDD sur :

- Le boilerplate NestJS (modules, controllers simples)
- Les fichiers de configuration

### Localisation des tests API

**CRITIQUE** : Jest `projects` config OVERRIDES top-level `testMatch`

- Tests unitaires : `apps/api/test/unit/` (guards/, controllers/, services/, auth/)
- Tests integration : `apps/api/test/integration/`
- Tests e2e : `apps/api/test/e2e/`
- Les fichiers `src/**/*.spec.ts` NE sont PAS decouverts par Jest
- Worker : `apps/worker/src/workers/__tests__/` (colocated avec `__tests__/`)

### Mocks patterns etablis

```typescript
// PrismaService — mock avec jest.fn() pour chaque methode
const prismaMock = { ticket: { findUnique: jest.fn(), findMany: jest.fn(), ... } };

// ConfigService
const configMock = { get: jest.fn((key) => configs[key]) };

// BullMQ Queue
{ add: jest.fn().mockResolvedValue({ id: 'job-123' }) }

// WebSocket Gateway
{ emitSessionUpdate: jest.fn(), emitNewMessage: jest.fn() }
```

## Frontend — TDD SYSTEMATIQUE avec Playwright

**OBLIGATOIRE pour tout travail dans `apps/dashboard/` :**

Chaque feature, page, ou composant interactif DOIT avoir un test Playwright e2e.
Claude utilise ces tests pour valider son travail et debugger lui-meme.

### Workflow TDD Frontend

1. **Ecrire le test Playwright d'abord** dans `apps/dashboard/e2e/`
2. **Lancer le test** : `cd apps/dashboard && npx playwright test e2e/<fichier>.spec.ts`
3. **Verifier qu'il echoue** (red) — le test decrit le comportement attendu
4. **Implementer** le composant/page
5. **Re-lancer le test** jusqu'a ce qu'il passe (green)
6. **Si le test echoue** : lire le rapport d'erreur, analyser le screenshot dans `e2e-results/`, corriger, re-tester
7. **Ne jamais livrer du code front sans que le test Playwright passe**

### Locators Playwright — REGLES STRICTES

**OBLIGATOIRE — locators semantiques uniquement :**

```typescript
// CORRECT
page.getByRole('button', { name: 'Submit' });
page.getByLabel('Email address');
page.getByText('Ticket created');
page.getByPlaceholder('Search tickets...');
page.getByTestId('related-tickets'); // data-testid seulement si pas d'alternative

// INTERDIT
page.locator('.submit-btn'); // CSS class
page.locator('#email'); // CSS id
page.locator('div > span'); // selectors structurels
```

**Anti-patterns interdits :**

- `waitForTimeout()` — utiliser les assertions auto-retry de Playwright
- CSS selectors `.className` ou `#id` pour localiser des elements
- `page.evaluate()` pour contourner les assertions

### Structure des tests

```
apps/dashboard/
├── e2e/                          # Tests Playwright e2e
│   ├── tickets.spec.ts           # Tests par domaine fonctionnel
│   ├── ticket-detail.spec.ts
│   ├── auth.spec.ts
│   └── helpers/                  # Utilitaires partages (login, fixtures)
│       └── auth.ts
├── playwright.config.ts          # Config e2e (headless, workers: 1)
└── playwright.demo.config.ts     # Config demo (headed, slowMo, video)
```

### Convention de nommage

- Fichier : `<domaine>.spec.ts` (ex: `ticket-relations.spec.ts`)
- Tests : `test.describe('<Page/Feature>', () => { test('<action attendue>', ...) })`
- Naming BDD : `Given [...], When [...], Then [...]`

### Commandes

```bash
# Lancer un test specifique (le plus courant)
cd apps/dashboard && npx playwright test e2e/<fichier>.spec.ts

# Lancer avec navigateur visible (pour debugger)
cd apps/dashboard && npx playwright test e2e/<fichier>.spec.ts --headed

# Voir le rapport apres echec
cd apps/dashboard && npx playwright show-report

# Lancer tous les e2e (rare, seulement avant commit)
cd apps/dashboard && npx playwright test
```

### Prerequis

- `pnpm dev` doit tourner (le dashboard sur localhost:3000)
- Les tests tournent contre le serveur de dev, pas de build necessaire
- **workers: 1** dans la config — un seul test a la fois pour economiser la RAM

### Debugging automatique

Quand un test Playwright echoue :

1. Lire le message d'erreur dans la sortie
2. Verifier les screenshots dans `e2e-results/` si disponibles
3. Relancer avec `--headed` pour voir visuellement ce qui se passe
4. Corriger le code, PAS le test (sauf si le test est mal ecrit)
5. Re-lancer jusqu'au vert

### Exemple de test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Ticket Relations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@test.local');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
  });

  test('displays related tickets section when relations exist', async ({ page }) => {
    // Given
    await page.goto('/dashboard/tickets/<ticket-id>');
    // Then
    const section = page.getByTestId('related-tickets');
    await expect(section).toBeVisible();
    await expect(section.getByRole('link')).toHaveCount(2);
  });

  test('hides related tickets section when no relations', async ({ page }) => {
    await page.goto('/dashboard/tickets/<ticket-without-relations>');
    await expect(page.getByTestId('related-tickets')).not.toBeVisible();
  });
});
```

## Tests unitaires Dashboard (Vitest + Testing Library)

- Localisation : `apps/dashboard/components/**/__tests__/*.test.tsx`
- Setup : `apps/dashboard/tests/setup.tsx`
- **jsdom ne definit pas MediaError** — le mocker dans setup.tsx
- Video elements n'ont pas de role accessible — utiliser `container.querySelector('video')`

## Gestion des ressources (CRITIQUE)

- **JAMAIS `pnpm test` global** — ca lance tout en parallele et tue la RAM
- Tester **un package a la fois**, sequentiellement
- Limiter les workers Jest : `--maxWorkers=2` (ou `--maxWorkers=1` si dev tourne)
- Playwright : **workers: 1** (deja dans la config)
- Privilegier les tests cibles : `npx jest --maxWorkers=1 <pattern>`
- Si `pnpm dev` tourne deja (~4 GB RAM), lancer les tests avec `--maxWorkers=1`

## Quand ecrire des tests

- Nouveau service ou methode avec logique metier → TDD Jest (RED d'abord)
- Nouveau endpoint API → test d'integration Jest
- Bug fix backend → ecrire le test qui reproduit le bug AVANT de corriger
- **Toute modification frontend** → TDD Playwright (ecrire le test d'abord, implementer ensuite)
- **Nouveau composant interactif** → test Playwright obligatoire
- **Bug fix frontend** → ecrire le test Playwright qui reproduit le bug, puis corriger
- Refactoring → s'assurer que les tests existants couvrent le comportement

## Regles de stabilite

- Ne jamais desactiver un test existant pour faire passer une feature
- Ne jamais supprimer une regle ESLint sans justification documentee
- Chaque feature doit etre stable (build + tests + lint) avant de passer a la suivante
- Si un test echoue : corriger le code, pas le test

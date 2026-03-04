---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
---

# Pratiques de test

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

## Backend — TDD avec Jest

Pour les services et la logique metier :

1. Ecrire le test qui decrit le comportement attendu
2. Verifier qu'il echoue (red)
3. Implementer le minimum pour le faire passer (green)
4. Refactorer si necessaire (refactor)

Ne pas appliquer TDD sur :

- Le boilerplate NestJS (modules, controllers simples)
- Les fichiers de configuration

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

### Structure des tests

```
apps/dashboard/
├── e2e/                          # Tests Playwright e2e
│   ├── tickets.spec.ts           # Tests par domaine fonctionnel
│   ├── ticket-detail.spec.ts
│   ├── auth.spec.ts
│   └── helpers/                  # Utilitaires partagés (login, fixtures)
│       └── auth.ts
├── playwright.config.ts          # Config e2e (headless, workers: 1)
└── playwright.demo.config.ts     # Config demo (headed, slowMo, video)
```

### Convention de nommage

- Fichier : `<domaine>.spec.ts` (ex: `ticket-relations.spec.ts`)
- Tests : `test.describe('<Page/Feature>', () => { test('<action attendue>', ...) })`

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
    // login helper
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('displays related tickets section when relations exist', async ({ page }) => {
    await page.goto('/dashboard/tickets/<ticket-id>');
    const section = page.locator('[data-testid="related-tickets"]');
    await expect(section).toBeVisible();
    await expect(section.locator('a')).toHaveCount(2);
  });

  test('hides related tickets section when no relations', async ({ page }) => {
    await page.goto('/dashboard/tickets/<ticket-without-relations>');
    await expect(page.locator('[data-testid="related-tickets"]')).not.toBeVisible();
  });
});
```

## Gestion des ressources (CRITIQUE)

- **JAMAIS `pnpm test` global** — ca lance tout en parallele et tue la RAM
- Tester **un package a la fois**, sequentiellement
- Limiter les workers Jest : `--maxWorkers=2`
- Playwright : **workers: 1** (deja dans la config)
- Privilegier les tests cibles : `npx jest --maxWorkers=1 <pattern>`
- Si `pnpm dev` tourne deja (~4 GB RAM), lancer les tests avec `--maxWorkers=1`

## Quand ecrire des tests

- Nouveau service ou methode avec logique metier → TDD Jest
- Nouveau endpoint API → test d'integration Jest
- Bug fix backend → ecrire le test qui reproduit le bug AVANT de corriger
- **Toute modification frontend** → TDD Playwright (ecrire le test d'abord, implementer ensuite)
- **Nouveau composant interactif** → test Playwright obligatoire
- **Bug fix frontend** → ecrire le test Playwright qui reproduit le bug, puis corriger
- Refactoring → s'assurer que les tests existants couvrent le comportement

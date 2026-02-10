# Phase 10 — Validation finale

## Prérequis

Toutes les phases 2-9 terminées. Chaque workspace build individuellement.

## Objectif

Vérifier que TOUT fonctionne ensemble : build global, lint, tests.

## Étapes

### 1. Clean install

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install 2>&1 | tail -20
```

### 2. Générer Prisma

```bash
cd apps/api && npx prisma generate 2>&1 | tail -5
cd ../..
```

### 3. Build global

```bash
pnpm build 2>&1
echo "EXIT CODE: $?"
```

Si erreur → identifier le workspace, aller corriger, re-builder ce workspace seul, puis relancer `pnpm build`.

### 4. Lint global

```bash
pnpm lint 2>&1 | tail -30
echo "EXIT CODE: $?"
```

Si erreurs de lint → corriger les plus critiques (imports inutilisés, variables non utilisées). Les warnings de style sont secondaires.

### 5. Tests

```bash
pnpm test 2>&1 | tail -30
echo "EXIT CODE: $?"
```

Si tests échouent → lire chaque test qui fail, comprendre pourquoi, corriger UN PAR UN.

### 6. Vérifier Docker Compose (si Docker est disponible)

```bash
docker compose config 2>&1 | tail -5
```

## Livrable final

Mettre à jour `AUDIT.md` avec une section finale :

```markdown
## Résultat final

| Vérification | Statut |
|-------------|--------|
| `pnpm install` | ✅/❌ |
| `pnpm build` | ✅/❌ |
| `pnpm lint` | ✅/❌ (X warnings) |
| `pnpm test` | ✅/❌ (X/Y passent) |
| `docker compose config` | ✅/❌/⏭️ |

### Workspaces
| Workspace | Build | Test |
|-----------|-------|------|
| @support-helper/shared | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/database | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/sdk-web | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/api | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/worker | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/dashboard | ✅/❌ | ✅/❌/⏭️ |
| @support-helper/web | ✅/❌ | ✅/❌/⏭️ |

### Problèmes restants (si applicable)
1. [description — pourquoi pas corrigé, prochaines étapes]
```

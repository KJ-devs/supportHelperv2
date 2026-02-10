# Phase 1 — Audit complet du monorepo

## Objectif

Analyser l'état réel du projet et produire un rapport exhaustif de TOUT ce qui est cassé.
Tu ne corriges RIEN dans cette phase. Tu audites uniquement.

## Étapes à exécuter dans l'ordre

### 1. Structure du workspace

```bash
cat pnpm-workspace.yaml
cat package.json | head -40
cat tsconfig.json
ls -la apps/
ls -la packages/
```

Vérifie que tous les workspaces déclarés existent réellement sur le disque.

### 2. Package.json de chaque workspace

```bash
for dir in packages/shared packages/database packages/sdk-web apps/api apps/worker apps/dashboard apps/web; do
  echo "========== $dir =========="
  if [ -f "$dir/package.json" ]; then
    cat "$dir/package.json"
  else
    echo "⚠️ MANQUANT : $dir/package.json"
  fi
  echo ""
done
```

Pour chaque workspace, vérifie :
- Le `name` est au format `@support-helper/<nom>`
- Les champs `main`, `types`, `exports` pointent vers des fichiers qui existent
- Le script `build` existe et est cohérent
- Les `dependencies` et `devDependencies` référencent des versions compatibles
- Les dépendances internes (`@support-helper/*`) sont déclarées avec `workspace:*`

### 3. TSConfig de chaque workspace

```bash
for dir in packages/shared packages/database packages/sdk-web apps/api apps/worker apps/dashboard apps/web; do
  echo "========== $dir =========="
  if [ -f "$dir/tsconfig.json" ]; then
    cat "$dir/tsconfig.json"
  elif [ -f "$dir/tsconfig.build.json" ]; then
    cat "$dir/tsconfig.build.json"
  else
    echo "⚠️ AUCUN tsconfig trouvé"
  fi
  echo ""
done
```

### 4. Schéma Prisma

```bash
cat apps/api/prisma/schema.prisma
```

Note les modèles, les relations, les enums, et les champs AI (aiSummary, aiAnalysis, keywords, typeConfidence, severityConfidence, embeddings).

### 5. Docker Compose

```bash
cat docker-compose.yml
```

Vérifie que les services PostgreSQL, Redis, MinIO, MeiliSearch sont déclarés.

### 6. Variables d'environnement

```bash
find . -name ".env.example" -not -path "*/node_modules/*" | while read f; do
  echo "========== $f =========="
  cat "$f"
  echo ""
done
```

### 7. Build complet — capturer TOUTES les erreurs

```bash
pnpm install 2>&1 | tail -30

# Build workspace par workspace pour identifier les erreurs précisément
echo "=== packages/shared ===" && pnpm --filter @support-helper/shared build 2>&1 | tail -20
echo "=== packages/database ===" && pnpm --filter @support-helper/database build 2>&1 | tail -20
echo "=== packages/sdk-web ===" && pnpm --filter @support-helper/sdk-web build 2>&1 | tail -20
echo "=== apps/api ===" && pnpm --filter @support-helper/api build 2>&1 | tail -40
echo "=== apps/worker ===" && pnpm --filter @support-helper/worker build 2>&1 | tail -40
echo "=== apps/dashboard ===" && pnpm --filter @support-helper/dashboard build 2>&1 | tail -40
echo "=== apps/web ===" && pnpm --filter @support-helper/web build 2>&1 | tail -40
```

### 8. Lint (si disponible)

```bash
pnpm lint 2>&1 | tail -50
```

### 9. Tests (si disponible)

```bash
pnpm test 2>&1 | tail -50
```

## Livrable

Crée le fichier `AUDIT.md` à la racine du projet avec ce format exact :

```markdown
# AUDIT — supportHelperv2
Date : [date du jour]

## Résumé
- Nombre total d'erreurs de build : X
- Workspaces qui buildent : [liste]
- Workspaces qui ne buildent pas : [liste]

## Erreurs par workspace

### packages/shared
- ✅ Build OK / ❌ Build KO
- Erreurs : [liste chaque erreur avec fichier:ligne et message]

### packages/database
[idem]

### packages/sdk-web
[idem]

### apps/api
[idem]

### apps/worker
[idem]

### apps/dashboard
[idem]

### apps/web
[idem]

## Dépendances manquantes
- [workspace] : import de `X` mais `X` n'est pas dans package.json

## Types cassés
- [fichier:ligne] : [description de l'erreur de type]

## Incohérences
- [description : versions incompatibles, exports manquants, etc.]

## Plan de correction priorisé
1. [correction la plus bloquante en premier]
2. ...
```

RAPPEL : Ne corrige RIEN. Audite seulement. Le rapport AUDIT.md sera utilisé dans la phase suivante.

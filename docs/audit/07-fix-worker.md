# Phase 7 — Corriger apps/worker

## Prérequis

- Phase 6 terminée : `pnpm --filter @support-helper/api build` ✅
- Lis `AUDIT.md` section `apps/worker`

## Contexte

Le worker NestJS traite les jobs BullMQ en background :
- `video-analysis` : S3 → FFmpeg → OCR → GPT-4 Vision → embeddings → DB
- `github-sync` : Synchronisation bidirectionnelle GitHub
- `agent` : Agent IA GPT-4o avec function calling
- `integration-sync` : Sync vers Slack/Discord/Notion

**IMPORTANT** : Le worker partage le schéma Prisma avec l'API. Il ne possède PAS sa propre copie.
Le chemin dans le worker pointe vers `../api/prisma/schema.prisma`.

## Étapes

### 1. Lire la structure

```bash
cat apps/worker/package.json
cat apps/worker/tsconfig.json
cat apps/worker/nest-cli.json 2>/dev/null
ls -la apps/worker/src/
find apps/worker/src/ -name "*.ts" | sort
```

### 2. Vérifier le lien Prisma

Le worker utilise le schéma Prisma de l'API. Vérifier que la référence est correcte :

```bash
# Chercher la référence au schéma Prisma dans le worker
grep -r "schema.prisma\|prisma.*schema\|../api/prisma" apps/worker/ --include="*.ts" --include="*.json" | grep -v node_modules | head -10

# Vérifier que le schéma existe au chemin attendu (relatif depuis apps/worker)
ls apps/api/prisma/schema.prisma
```

Si le worker a son propre `prisma/schema.prisma`, il doit être identique ou supprimé au profit de celui de l'API.

### 3. Vérifier le PrismaService du worker

```bash
# Comment le worker initialise Prisma
find apps/worker/src/ -name "*prisma*" | sort
cat apps/worker/src/services/prisma.service.ts 2>/dev/null
```

Le PrismaService du worker doit utiliser le client Prisma généré depuis le schéma de l'API.

### 4. Lire les fichiers sources

```bash
# Headers de chaque fichier pour comprendre les imports
find apps/worker/src/ -name "*.ts" -exec echo "=== {} ===" \; -exec head -30 {} \;
```

### 5. Vérifier les imports cross-workspace

```bash
grep -r "from '@support-helper/" apps/worker/src/ --include="*.ts" | head -20
```

Le worker dépend typiquement de :
- `@support-helper/shared` (types)
- `@prisma/client` (généré depuis le schéma de l'API)

### 6. Vérifier les dépendances spécifiques au worker

```bash
cat apps/worker/package.json | grep -A5 "dependencies"
```

Le worker a besoin de packages spécifiques :
- `@nestjs/bullmq` ou `bullmq` — File de jobs
- `fluent-ffmpeg` ou `@ffmpeg-installer/ffmpeg` — Extraction de keyframes
- `tesseract.js` — OCR
- `openai` — GPT-4 Vision + embeddings
- `@prisma/client` — DB
- `ioredis` — Redis

Vérifier que chacun est déclaré dans le package.json.

### 7. Builder

```bash
pnpm --filter @support-helper/worker build 2>&1
echo "Exit code: $?"
```

Si erreurs → les corriger UNE PAR UNE :
1. Lire le fichier qui a l'erreur
2. Comprendre l'erreur
3. Corriger
4. Re-builder
5. Passer à l'erreur suivante

### 8. Tests (si disponibles)

```bash
pnpm --filter @support-helper/worker test 2>&1 | tail -30
```

## Validation

```bash
pnpm --filter @support-helper/worker build 2>&1 | tail -10
```

## Rapport

```
## Phase 7 : apps/worker — ✅/❌

### Problèmes corrigés :
1. [description] → [correction]

### Fichiers modifiés :
- [chemin] : [changement]

### Lien Prisma :
- Schéma utilisé : [chemin]
- PrismaService : [chemin]

### Validation :
- `pnpm --filter @support-helper/worker build` → ✅/❌
- `pnpm --filter @support-helper/worker test` → ✅/❌/⏭️ (skipped)
```

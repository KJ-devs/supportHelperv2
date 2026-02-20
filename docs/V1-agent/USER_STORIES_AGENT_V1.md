# User Stories — Agent IA Intelligent V1

## Référence : supportHelperv2

> **Convention** : Chaque US est auto-suffisante et contient tout le contexte nécessaire pour être implémentée par Claude Code sans intervention humaine. Les US sont ordonnées par dépendance.

---

## Wave 1 — Fondations (Code Investigation Service)

### US-1.1 — CodeInvestigationService : accès lecture au repo

**En tant que** service backend,
**je veux** pouvoir lire des fichiers, lister des répertoires et chercher du code dans un repo GitHub connecté,
**afin que** l'agent AI puisse investiguer le codebase.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/code-investigation.service.ts`
- [ ] Méthode `getRepoContext(applicationId)` : résout `ProjectGithubConfig` → `GithubInstallation` → retourne un Octokit scopé + owner/repo/defaultBranch
- [ ] Méthode `readFile(ctx, filePath, startLine?, endLine?)` : lit un fichier via `octokit.repos.getContent()`, décode le base64, supporte le filtrage par lignes
- [ ] Méthode `listDirectory(ctx, path, recursive?)` : liste via `octokit.git.getTree()`, filtre par profondeur si recursive (max 2 levels)
- [ ] Méthode `searchCode(ctx, query, filePattern?, maxResults?)` : utilise `octokit.rest.search.code()` avec le repo scope
- [ ] Méthode `getRepoStructure(ctx, maxDepth?, excludePatterns?)` : arbre condensé via recursive tree, exclut node_modules/dist/.git par défaut, retourne un string formaté en arborescence
- [ ] Méthode `getFileHistory(ctx, filePath, limit?)` : `octokit.repos.listCommits()` avec path filter
- [ ] Méthode `getFileBlame(ctx, filePath, startLine?, endLine?)` : utilise l'API GraphQL GitHub ou REST pour obtenir le blame
- [ ] Cache Redis sur `getRepoStructure()` (TTL 1h, clé : `repo-structure:{applicationId}`)
- [ ] Cache Redis sur `readFile()` (TTL 10min, clé : `repo-file:{applicationId}:{filePath}:{ref}`)
- [ ] Gestion d'erreurs : 404 → retourne message clair "File not found", rate limit → retry avec backoff
- [ ] Le service utilise `GithubAppService.getInstallationOctokit()` existant (ne pas réimplémenter)
- [ ] Tests unitaires avec Octokit mocké

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/code-investigation.service.ts`
- `apps/api/test/unit/services/code-investigation.service.spec.ts`

**Dépendances existantes :**
- `apps/api/src/modules/github/services/github-app.service.ts` (GithubAppService)
- `apps/api/src/cache/cache.service.ts` (CacheService)
- `apps/api/prisma/schema.prisma` (ProjectGithubConfig, GithubInstallation)

---

### US-1.2 — Définitions des Tools Anthropic

**En tant que** développeur,
**je veux** avoir les 12 définitions de tools Anthropic dans un fichier dédié,
**afin que** la boucle agentique puisse les passer à l'API Anthropic.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/agent-tools.ts`
- [ ] Exporte un array `AGENT_TOOLS: Anthropic.Tool[]` contenant 12 tools :
  - `read_file` (file_path, start_line?, end_line?)
  - `list_directory` (path, recursive?)
  - `search_code` (query, file_pattern?, max_results?)
  - `search_codebase_semantic` (query, limit?)
  - `get_repo_structure` (max_depth?, exclude_patterns?)
  - `get_file_history` (file_path, limit?)
  - `get_file_blame` (file_path, start_line?, end_line?)
  - `update_diagnosis` (root_cause, affected_files?, confidence, suggested_fix?, remaining_questions?)
  - `search_similar_tickets` (query, limit?)
  - `get_ticket_details` (ticket_id)
  - `update_ticket_status` (ticket_id, status)
  - `escalate_to_human` (ticket_id, reason, priority?)
- [ ] Chaque tool a un `description` clair qui guide Claude sur quand l'utiliser
- [ ] Les `input_schema` sont des JSON Schema valides avec types, descriptions et required fields
- [ ] Exporte aussi un type `ToolName` = union des noms de tools
- [ ] Exporte un type `ToolCallResult` avec toolCallId, name, input, result, error?, durationMs

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/agent-tools.ts`

**Dépendances :**
- Package `@anthropic-ai/sdk` (déjà installé dans le projet)

---

### US-1.3 — ToolExecutorService : dispatch des tool calls

**En tant que** service backend,
**je veux** un dispatcher qui route chaque tool call vers la bonne implémentation,
**afin que** la boucle agentique puisse exécuter les tools de manière uniforme.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/tool-executor.service.ts`
- [ ] Méthode `execute(toolName, input, context)` : switch sur le nom du tool et appelle la bonne méthode
- [ ] Le `context` contient : `repoCtx` (RepoContext | null), `ticket`, `tenantId`, `applicationId`
- [ ] Tools code-source (read_file, list_directory, search_code, get_repo_structure, get_file_history, get_file_blame) → délèguent à `CodeInvestigationService`
- [ ] `search_codebase_semantic` → délègue à `CodebaseSearchService.findRelevantFiles()` existant
- [ ] `update_diagnosis` → retourne le diagnostic formaté (sera persisté par l'appelant)
- [ ] `search_similar_tickets` → utilise `AIService.generateEmbedding()` + raw SQL pgvector (comme l'existant)
- [ ] `get_ticket_details` → Prisma query avec includes (media, videoEvents, application)
- [ ] `update_ticket_status` → Prisma update + TicketEvent creation
- [ ] `escalate_to_human` → Prisma update session + ticket assignment
- [ ] Si `repoCtx` est null (pas de repo connecté) et un tool code-source est appelé → retourne `{ error: "No repository connected to this application. Connect a GitHub repo in Settings > GitHub." }`
- [ ] Chaque exécution est wrappée dans try/catch, les erreurs sont retournées comme `{ error: message }` (pas de throw)
- [ ] Log chaque tool call avec durée d'exécution
- [ ] Tests unitaires pour chaque tool handler

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/tool-executor.service.ts`
- `apps/api/test/unit/services/tool-executor.service.spec.ts`

**Dépendances :**
- US-1.1 (CodeInvestigationService)
- US-1.2 (AGENT_TOOLS, ToolName)
- `CodebaseSearchService` existant
- `AIService` existant
- `PrismaService`

---

## Wave 2 — Boucle Agentique

### US-2.1 — AgenticLoopService : boucle Anthropic tool_use

**En tant que** service backend,
**je veux** une boucle de conversation Anthropic qui exécute des tools automatiquement jusqu'à obtenir une réponse finale,
**afin que** l'agent puisse raisonner et investiguer de manière autonome.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/agentic-loop.service.ts`
- [ ] Méthode `run(options: AgenticLoopOptions): Promise<AgenticLoopResult>`
- [ ] `AgenticLoopOptions` contient : systemPrompt, initialMessage, tools, repoCtx, ticket, tenantId, maxIterations (default 15), maxTokens (default 4096), existingMessages? (pour conversation continue)
- [ ] `AgenticLoopResult` contient : finalContent (string), toolCallLog (ToolCallResult[]), iterations (number), messages (Anthropic.MessageParam[])
- [ ] La boucle :
  1. Appelle `anthropic.messages.create()` avec system, messages, tools
  2. Si response contient des `tool_use` blocks → exécute chaque tool via `ToolExecutorService`
  3. Ajoute le message assistant puis les tool_results au messages array
  4. Répète jusqu'à : pas de tool_use OU maxIterations atteint OU stop_reason === 'end_turn'
  5. Retourne le dernier text content comme finalContent
- [ ] Utilise `AnthropicClientFactory.createForTenant(tenantId)` pour obtenir le client (BYOK support)
- [ ] Fallback : si pas de client Anthropic configuré, utilise la clé système `ANTHROPIC_API_KEY`
- [ ] Si ni tenant ni système n'ont de clé → throw `ServiceUnavailableException('No AI provider configured')`
- [ ] Le model est lu depuis `AiConfig` du tenant (default: `claude-sonnet-4-20250514`)
- [ ] Timeout global configurable (default: 120s pour deep analysis, 30s pour conversation)
- [ ] Émet des events via un `EventEmitter` pour que le WebSocket puisse streamer les étapes au dashboard :
  - `agent:tool_call` → { toolName, input }
  - `agent:tool_result` → { toolName, durationMs, hasError }
  - `agent:thinking` → { iteration }
  - `agent:complete` → { finalContent }
- [ ] Tests unitaires avec Anthropic client mocké

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/agentic-loop.service.ts`
- `apps/api/test/unit/services/agentic-loop.service.spec.ts`

**Dépendances :**
- US-1.2 (AGENT_TOOLS)
- US-1.3 (ToolExecutorService)
- `AnthropicClientFactory` existant (`apps/api/src/modules/ai-config/anthropic-client.factory.ts`)
- `AiConfigService` existant

---

### US-2.2 — DiagnosisService : gestion du diagnostic structuré

**En tant que** service backend,
**je veux** persister et récupérer le diagnostic structuré d'un ticket,
**afin que** le diagnostic survive entre les sessions et soit utilisable par le frontend et la code generation.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/diagnosis.service.ts`
- [ ] Migration Prisma : ajouter les champs `diagnosis` (Json?, JsonB) et `diagnosisUpdatedAt` (DateTime?) au model `Ticket`
- [ ] Interface `Diagnosis` :
  ```typescript
  interface Diagnosis {
    rootCause: string;
    affectedFiles: Array<{
      filePath: string;
      relevance: 'primary' | 'secondary' | 'context';
      description: string;
      codeSnippet?: string;
    }>;
    confidence: number;
    suggestedFix?: string;
    remainingQuestions?: string[];
    investigationLog?: Array<{
      toolName: string;
      summary: string;
      timestamp: string;
    }>;
  }
  ```
- [ ] Méthode `saveDiagnosis(ticketId, tenantId, diagnosis, loopResult)` : met à jour le ticket + crée un TicketEvent de type `diagnosis_updated`
- [ ] Méthode `getDiagnosis(ticketId): Promise<Diagnosis | null>` : lit depuis le champ JSON du ticket
- [ ] Méthode `extractDiagnosisFromToolCalls(toolCallLog)` : parcourt le toolCallLog pour trouver le dernier appel à `update_diagnosis` et retourne le Diagnosis
- [ ] Tests unitaires

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/diagnosis.service.ts`
- `apps/api/prisma/migrations/YYYYMMDD_add_diagnosis_fields/migration.sql`
- `apps/api/test/unit/services/diagnosis.service.spec.ts`

**Fichiers à modifier :**
- `apps/api/prisma/schema.prisma` (ajouter champs diagnosis au model Ticket)

---

## Wave 3 — Deep Analysis Pipeline

### US-3.1 — DeepAnalysisService : analyse automatique à la création du ticket

**En tant que** système,
**je veux** que chaque nouveau ticket avec un repo connecté soit automatiquement analysé en profondeur par l'agent,
**afin que** le diagnostic soit prêt quand le développeur ouvre le ticket.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/deep-analysis.service.ts`
- [ ] Méthode `analyze(ticketId, tenantId): Promise<Diagnosis>` :
  1. Charge le ticket avec application et media (includes)
  2. Résout le `RepoContext` via `CodeInvestigationService.getRepoContext()`
  3. Si pas de repo → exécute une analyse basique (comme aujourd'hui, juste AI sur la description)
  4. Si repo connecté :
     a. Récupère la structure du repo (cached)
     b. Construit le system prompt complet (ticket context + repo structure + video OCR si dispo)
     c. Lance `AgenticLoopService.run()` avec maxIterations=15
     d. Extrait le diagnostic du toolCallLog
     e. Persiste via `DiagnosisService.saveDiagnosis()`
  5. Met à jour le statut du ticket → `analyzing` pendant l'analyse, `analyzed` après
  6. Crée un `TicketEvent` de type `deep_analysis_completed`
- [ ] Le system prompt inclut les informations vidéo (OCR text des videoEvents) si le ticket a des media
- [ ] Si l'analyse échoue (timeout, erreur API) → log l'erreur, marque le ticket comme `analysis_failed`, ne bloque pas le flow
- [ ] Méthode `buildSystemPrompt(ticket, repoStructure, videoContext?)` : génère le prompt complet (voir architecture doc)

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/deep-analysis.service.ts`
- `apps/api/test/unit/services/deep-analysis.service.spec.ts`

**Dépendances :**
- US-1.1, US-2.1, US-2.2

---

### US-3.2 — Worker BullMQ pour la Deep Analysis

**En tant que** système,
**je veux** que la deep analysis soit exécutée en background via BullMQ,
**afin de** ne pas bloquer la création de ticket.

**Critères d'acceptation :**
- [ ] Nouveau worker `apps/worker/src/workers/deep-analysis.worker.ts` ou nouveau job type dans `agent.worker.ts`
- [ ] Nouveau queue name `QUEUE_NAMES.DEEP_ANALYSIS = 'deep-analysis'`
- [ ] Job data : `{ ticketId: string, tenantId: string, applicationId: string }`
- [ ] Le worker appelle `DeepAnalysisService.analyze()`
- [ ] Retry strategy : exponential backoff (30s, 2min, 10min), max 3 attempts
- [ ] Concurrency : 5 (pas trop pour ne pas saturer l'API GitHub)
- [ ] En cas d'échec final → dead letter queue
- [ ] Modification de `TicketsService.create()` : après la création du ticket, si l'application a un `ProjectGithubConfig`, enqueue un job `deep-analysis`
- [ ] Modification de `SdkTicketsController.report()` : idem, enqueue deep analysis après le traitement AI inline
- [ ] Le job émet des progress updates pour le suivi temps réel

**Fichiers à créer :**
- `apps/worker/src/workers/deep-analysis.worker.ts` (ou modifier agent.worker.ts)

**Fichiers à modifier :**
- `apps/worker/src/queues/queue.types.ts` (ajouter DeepAnalysisJobData)
- `apps/worker/src/queues/index.ts` (ajouter DEEP_ANALYSIS)
- `apps/api/src/modules/tickets/tickets.service.ts` (enqueue deep analysis)
- `apps/api/src/modules/tickets/sdk-tickets.controller.ts` (enqueue deep analysis)

---

## Wave 4 — Agent Conversationnel

### US-4.1 — Agent Chat Controller V2 (REST + WebSocket)

**En tant que** développeur utilisant le dashboard,
**je veux** pouvoir chatter avec l'agent AI sur un ticket et recevoir des réponses basées sur le code source,
**afin de** comprendre le bug en profondeur.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/agent-v2.controller.ts`
- [ ] Endpoints REST :
  - `POST /agent/sessions` → créer une session pour un ticket (body: { ticketId })
  - `POST /agent/sessions/:sessionId/messages` → envoyer un message (body: { content })
  - `GET /agent/sessions/:sessionId` → statut de la session + diagnostic actuel
  - `GET /agent/sessions/:sessionId/messages` → historique des messages
  - `GET /tickets/:ticketId/diagnosis` → diagnostic structuré du ticket
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/agent-v2.gateway.ts`
- [ ] WebSocket events :
  - Client émet `agent:send_message` → { sessionId, content }
  - Server émet `agent:message` → { sessionId, content, toolsUsed }
  - Server émet `agent:tool_call` → { sessionId, toolName, status: 'executing' | 'completed' }
  - Server émet `agent:typing` → { sessionId, isTyping: boolean }
  - Server émet `agent:diagnosis_updated` → { ticketId, diagnosis }
- [ ] Le handler `sendMessage` :
  1. Sauvegarde le message utilisateur dans `AgentMessage`
  2. Charge la session + ticket + diagnostic existant + historique messages
  3. Reconstruit le `existingMessages` Anthropic à partir de l'historique
  4. Lance `AgenticLoopService.run()` avec les messages existants
  5. Sauvegarde la réponse agent dans `AgentMessage`
  6. Met à jour le diagnostic si `update_diagnosis` a été appelé
  7. Émet la réponse via WebSocket
- [ ] Tous les endpoints sont protégés par `JwtAuthGuard` et scopés par tenant
- [ ] Tests unitaires pour le controller

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/agent-v2.controller.ts`
- `apps/api/src/modules/agent-v2/agent-v2.gateway.ts`
- `apps/api/test/unit/controllers/agent-v2.controller.spec.ts`

---

### US-4.2 — AgentV2Module : assemblage NestJS

**En tant que** développeur,
**je veux** un module NestJS propre qui assemble tous les services de l'agent V2,
**afin que** tout soit correctement injecté et importable.

**Critères d'acceptation :**
- [ ] Nouveau fichier `apps/api/src/modules/agent-v2/agent-v2.module.ts`
- [ ] Importe et fournit :
  - `CodeInvestigationService`
  - `ToolExecutorService`
  - `AgenticLoopService`
  - `DiagnosisService`
  - `DeepAnalysisService`
  - `AgentV2Controller`
  - `AgentV2Gateway`
- [ ] Importe les modules dépendants :
  - `GithubModule` (pour GithubAppService)
  - `CodebaseIndexModule` (pour CodebaseSearchService)
  - `AIModule` (pour AIService)
  - `AiConfigModule` (pour AnthropicClientFactory)
  - `RedisCacheModule` (pour CacheService)
  - `PrismaModule`
  - `BullModule.registerQueue({ name: 'deep-analysis' })`
- [ ] Exporte `DeepAnalysisService` (pour que TicketsModule puisse enqueue)
- [ ] `AppModule` importe `AgentV2Module`

**Fichiers à créer :**
- `apps/api/src/modules/agent-v2/agent-v2.module.ts`
- `apps/api/src/modules/agent-v2/index.ts` (barrel export)

**Fichiers à modifier :**
- `apps/api/src/app.module.ts` (ajouter AgentV2Module aux imports)

---

## Wave 5 — Indexation améliorée

### US-5.1 — Indexation initiale améliorée

**En tant que** système,
**je veux** que quand un repo est connecté à une application, le codebase soit indexé automatiquement avec des embeddings de qualité,
**afin que** `search_codebase_semantic` retourne des résultats pertinents.

**Critères d'acceptation :**
- [ ] Modifier `apps/worker/src/workers/codebase-indexing.worker.ts` :
  - Utiliser `CodeInvestigationService.getRepoContext()` pour accéder au repo
  - Récupérer l'arbre complet du repo via `octokit.git.getTree({ recursive: true })`
  - Filtrer les fichiers indexables : `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.java`, `.rb`, `.vue`, `.svelte`, `.css`, `.scss`, `.json` (config seulement), `.yml`, `.yaml`, `.md` (README seulement)
  - Exclure : `node_modules/`, `dist/`, `.git/`, `*.lock`, `*.min.js`, `*.map`, fichiers > 100KB
  - Pour chaque fichier : lire le contenu → chunker (utiliser `code-chunker.ts` existant) → générer embedding → upsert dans `codebase_embeddings`
  - L'embedding est généré sur `"${filePath}\n${chunkContent}"` pour inclure le contexte du path
  - Mettre à jour `CodebaseIndexStatus` avec progression : status, totalFiles, totalChunks, lastIndexedAt
  - Processing par batch de 10 fichiers en parallèle
  - Émettre un event `codebase:indexing_progress` via BullMQ job progress
- [ ] Déclencher automatiquement quand `ProjectGithubConfig` est créé (depuis le controller `project-github.controller.ts`)
- [ ] Possibilité de re-trigger manuellement via `POST /codebase-index/reindex`

**Fichiers à modifier :**
- `apps/worker/src/workers/codebase-indexing.worker.ts`
- `apps/api/src/modules/codebase-index/codebase-index.controller.ts`
- `apps/api/src/modules/github/controllers/project-github.controller.ts`

---

### US-5.2 — Indexation incrémentale sur push

**En tant que** système,
**je veux** que quand du code est pushé sur le repo, seuls les fichiers modifiés soient re-indexés,
**afin que** les embeddings restent à jour sans re-indexer tout le repo.

**Critères d'acceptation :**
- [ ] Modifier `apps/api/src/modules/github/processors/github-webhook.processor.ts` :
  - Sur event `push` : extraire la liste des fichiers `added`, `modified`, `removed` depuis le payload
  - Pour les fichiers `added` et `modified` : enqueue un job `reindex-file` dans la queue codebase-indexing
  - Pour les fichiers `removed` : supprimer les embeddings correspondants (`prisma.codebaseEmbedding.deleteMany({ where: { applicationId, filePath } })`)
  - Dédupliquer les fichiers (un même fichier peut apparaître dans plusieurs commits du push)
- [ ] Le worker codebase-indexing gère un nouveau job type `reindex-file` : lit le fichier → re-chunk → re-embed → upsert
- [ ] Invalider le cache Redis de `getRepoStructure()` et des `readFile()` concernés
- [ ] Ne pas re-indexer les fichiers exclus (node_modules, etc.)
- [ ] Log le nombre de fichiers re-indexés

**Fichiers à modifier :**
- `apps/api/src/modules/github/processors/github-webhook.processor.ts`
- `apps/worker/src/workers/codebase-indexing.worker.ts`

---

## Wave 6 — Dashboard UI

### US-6.1 — Composant DiagnosisPanel

**En tant que** utilisateur du dashboard,
**je veux** voir le diagnostic AI structuré sur la page détail d'un ticket,
**afin de** comprendre instantanément la root cause identifiée par l'agent.

**Critères d'acceptation :**
- [ ] Nouveau composant `apps/dashboard/components/diagnosis/DiagnosisPanel.tsx`
- [ ] Affiche :
  - Confidence score (badge coloré : vert >0.8, orange 0.5-0.8, rouge <0.5)
  - Root cause (texte principal)
  - Affected files (liste avec icônes par relevance : 🔴 primary, 🟡 secondary, ⚪ context)
  - Suggested fix (si présent)
  - Remaining questions (si présentes, avec style alert)
  - Code snippets inline (avec syntax highlighting basique)
- [ ] État loading : skeleton pendant l'analyse
- [ ] État vide : "No diagnosis yet" avec info "Analysis runs automatically when a repo is connected"
- [ ] État erreur : message d'erreur avec bouton "Retry Analysis"
- [ ] Bouton "🤖 Generate Fix" → navigue vers la page agent-tasks (US existantes)
- [ ] Bouton "💬 Ask Agent" → ouvre le chat agent (US-6.2)
- [ ] Intégration dans la page ticket détail `apps/dashboard/app/dashboard/tickets/[id]/page.tsx`
- [ ] Appel API : `GET /tickets/:id` (le diagnosis est dans le champ JSON du ticket)

**Fichiers à créer :**
- `apps/dashboard/components/diagnosis/DiagnosisPanel.tsx`
- `apps/dashboard/components/diagnosis/index.ts`

**Fichiers à modifier :**
- `apps/dashboard/app/dashboard/tickets/[id]/page.tsx` (ajouter DiagnosisPanel)

---

### US-6.2 — Composant AgentChatV2

**En tant que** utilisateur du dashboard,
**je veux** chatter avec l'agent AI dans un panneau latéral sur la page ticket,
**afin de** poser des questions sur le bug et recevoir des réponses basées sur le code.

**Critères d'acceptation :**
- [ ] Nouveau composant `apps/dashboard/components/agent-chat/AgentChatV2.tsx`
- [ ] UI :
  - Panneau latéral (Sheet/Drawer) ou section dans la page ticket
  - Liste de messages avec distinction user/agent (styles différents)
  - Messages agent avec indication des tools utilisés (badges discrets : "📂 read_file", "🔍 search_code")
  - Indicateur "Agent is investigating..." quand l'agent exécute des tools
  - Input de message avec bouton Send
  - Auto-scroll vers le dernier message
- [ ] Fonctionnel :
  - Au montage : `POST /agent/sessions` si pas de session existante pour ce ticket
  - Charge l'historique : `GET /agent/sessions/:sessionId/messages`
  - Envoi message : `POST /agent/sessions/:sessionId/messages`
  - WebSocket : écoute `agent:message`, `agent:tool_call`, `agent:typing` pour le temps réel
  - Optimistic update : affiche le message user immédiatement
- [ ] Le composant est intégré dans la page ticket détail à côté du DiagnosisPanel
- [ ] Responsive : sur mobile, le chat prend toute la largeur (Sheet full screen)

**Fichiers à créer :**
- `apps/dashboard/components/agent-chat/AgentChatV2.tsx`
- `apps/dashboard/components/agent-chat/ChatMessage.tsx`
- `apps/dashboard/components/agent-chat/ToolCallBadge.tsx`
- `apps/dashboard/components/agent-chat/index.ts`
- `apps/dashboard/hooks/useAgentChatV2.ts` (hook pour la logique)
- `apps/dashboard/lib/api/agent-v2.ts` (fonctions API)

**Fichiers à modifier :**
- `apps/dashboard/app/dashboard/tickets/[id]/page.tsx` (ajouter AgentChatV2)

---

## Wave 7 — Corrélation Vidéo ↔ Code

### US-7.1 — Enrichissement vidéo avec mapping code source

**En tant que** système,
**je veux** que l'analyse vidéo extraie des indices visuels (erreurs, composants, URLs) et les corrèle avec le code source,
**afin que** le diagnostic de l'agent soit plus précis quand une vidéo est fournie.

**Critères d'acceptation :**
- [ ] Modifier `apps/worker/src/workers/video-analysis.worker.ts` :
  - Après l'étape OCR, ajouter une étape "visual cue extraction" :
    - Extraire les stack traces / messages d'erreur du texte OCR
    - Extraire les URLs/routes visibles
    - Extraire les noms de composants/classes CSS visibles
  - Stocker ces indices dans le champ `metadata` du Media record sous la clé `visualCues`
- [ ] Modifier `DeepAnalysisService.buildSystemPrompt()` :
  - Si le ticket a des media avec `metadata.visualCues`, inclure ces indices dans le system prompt
  - Format : "Video shows error 'TypeError: Cannot read property X of undefined' at URL '/dashboard/tickets'. Component 'TicketTable' is visible."
  - L'agent utilisera naturellement `search_code("TypeError: Cannot read property X")` et `search_code("TicketTable")` pour trouver les fichiers concernés

**Fichiers à modifier :**
- `apps/worker/src/workers/video-analysis.worker.ts`
- `apps/api/src/modules/agent-v2/deep-analysis.service.ts`

---

## Ordre d'implémentation recommandé

```
Wave 1 (Fondations)     : US-1.1 → US-1.2 → US-1.3         ~ 2-3 jours
Wave 2 (Boucle agent)   : US-2.1 → US-2.2                    ~ 2 jours
Wave 3 (Deep Analysis)  : US-3.1 → US-3.2                    ~ 1-2 jours
Wave 4 (Chat agent)     : US-4.1 → US-4.2                    ~ 1-2 jours
Wave 5 (Indexation)     : US-5.1 → US-5.2                    ~ 1-2 jours
Wave 6 (Dashboard UI)   : US-6.1 → US-6.2                    ~ 2-3 jours
Wave 7 (Vidéo ↔ Code)   : US-7.1                             ~ 1 jour
                                                    Total: ~12-15 jours
```

Les Waves 1-4 sont le **critical path** — une fois implémentées, l'agent peut investiguer le code et chatter. Les Waves 5-7 sont des améliorations qui rendent le système plus performant et le frontend plus utilisable.

---

## Notes pour Claude Code

- Tous les nouveaux fichiers vont dans `apps/api/src/modules/agent-v2/` (nouveau module, ne pas modifier le module `agent` existant)
- Utiliser Anthropic `tool_use` natif (pas OpenAI function calling)
- Le model par défaut est `claude-sonnet-4-20250514` (configurable par tenant)
- Toujours scoper par `tenantId` (multi-tenant)
- Les tests utilisent Jest (pas Vitest) pour `apps/api`
- Pattern NestJS : `@Injectable()`, injection par constructeur, modules avec `providers` et `exports`
- Prisma migrations : `pnpm db:migrate` après modification du schema

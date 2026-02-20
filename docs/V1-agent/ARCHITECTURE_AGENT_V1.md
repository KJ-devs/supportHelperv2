# Architecture Technique — Agent IA Intelligent V1

## Document de référence pour supportHelperv2

> **Objectif** : Transformer l'agent actuel (aveugle au code) en un agent omniscient sur le codebase, capable de diagnostiquer les bugs en profondeur et de converser intelligemment avec les développeurs.

---

## 1. Diagnostic de l'existant

### Ce qui ne fonctionne pas aujourd'hui

L'agent actuel (`AgentService`, 2073 lignes) souffre de trois problèmes fondamentaux :

**1. Aveuglement au code source**
Les 5 tools disponibles (`search_similar_tickets`, `get_ticket_details`, `update_ticket_status`, `escalate_to_human`, `suggest_solution`) ne touchent jamais le repo GitHub. L'agent analyse un ticket avec uniquement le titre, la description et l'OCR vidéo — il ne sait pas quel framework est utilisé, quelle est l'architecture du projet, ni où se trouve le code concerné.

**2. Provider lock-in OpenAI pour le function calling**
Le `runWithFunctionCalling()` est hardcodé sur OpenAI GPT-4o. Le fallback Anthropic fait un simple `chatCompletion()` sans aucun outil. Comme le provider principal est Anthropic, l'agent perd 100% de ses capacités de raisonnement outillé.

**3. State machine trop rigide**
Le flow linéaire `ANALYZING → NEEDS_INFO → PROPOSING → WAITING → RESOLVED/ESCALATED` empêche l'agent de naviguer librement entre investigation du code et conversation. Un agent intelligent devrait pouvoir : lire un fichier → poser une question → relire un autre fichier → proposer un diagnostic, sans contrainte de séquence.

### Ce qui fonctionne et qu'on garde

| Composant | Status | Action |
|-----------|--------|--------|
| Schéma Prisma (AgentTask, AgentSession, CodebaseEmbedding...) | ✅ Solide | Garder, étendre |
| BullMQ queues + worker infrastructure | ✅ Solide | Garder |
| GithubAppService (JWT, installation tokens, Octokit) | ✅ Fonctionnel | Garder |
| GitAutomationService (branches, atomic commits) | ✅ Propre | Garder |
| PullRequestService (create/update PR) | ✅ Propre | Garder |
| CodebaseSearchService (pgvector search) | ✅ Fonctionnel | Garder, enrichir |
| CodebaseEmbedding model + indexing worker | ✅ Base existante | Garder, améliorer l'indexer |
| AI Provider Factory (Anthropic/OpenAI/Ollama) | ✅ Pattern ok | Garder |
| SDK Web (recording, context, upload) | ✅ Fonctionnel | Garder |
| Auth, Tickets, Media, infrastructure complète | ✅ Solide | Garder |

---

## 2. Architecture cible

### Vue d'ensemble du nouveau pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                     TICKET ARRIVES                                │
│  (SDK report / Dashboard create / GitHub webhook)                │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 1 — DEEP ANALYSIS                                        │
│                                                                  │
│  1. Enrichir la description (AI, comme aujourd'hui)              │
│  2. Identifier les fichiers potentiellement concernés            │
│     → RAG (CodebaseEmbedding pgvector)                          │
│     → Fetch dynamique via GitHub API si RAG insuffisant          │
│  3. Lire le code source des fichiers identifiés                  │
│  4. Corréler vidéo ↔ code (OCR text → mapping composants)       │
│  5. Produire un DIAGNOSTIC structuré :                           │
│     - Root cause probable                                        │
│     - Fichiers impliqués (avec extraits de code)                 │
│     - Niveau de confiance                                        │
│     - Questions restantes                                        │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 2 — AGENT CONVERSATIONNEL                                 │
│                                                                  │
│  L'agent répond aux questions avec le code sous les yeux.        │
│  À chaque message utilisateur, l'agent peut :                    │
│    → Lire/chercher dans le repo (tools)                          │
│    → Lancer une recherche sémantique dans le code                │
│    → Lister les fichiers d'un répertoire                         │
│    → Chercher un pattern dans le code (grep)                     │
│    → Consulter l'historique git d'un fichier                     │
│    → Mettre à jour le diagnostic                                 │
│    → Escalader si nécessaire                                     │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 3 — ACTION (existant, amélioré)                           │
│                                                                  │
│  Quand le diagnostic est confirmé :                              │
│    → Générer un action plan enrichi (basé sur le vrai code lu)   │
│    → Générer le code correctif                                   │
│    → Créer branche + commit + PR                                 │
│    → Suivre CI + itérer si échec                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Nouveau système de Tools (Anthropic tool_use)

L'agent passe de 5 outils "ticket-only" à **12 outils** dont 7 nouveaux pour le code :

```typescript
// ══════════════════════════════════════════════════
// TOOLS EXISTANTS (gardés, adaptés pour Anthropic)
// ══════════════════════════════════════════════════

search_similar_tickets    // Recherche pgvector sur les tickets résolus
get_ticket_details        // Détails complets d'un ticket
update_ticket_status      // Mettre à jour le statut
escalate_to_human         // Escalader vers un humain

// ══════════════════════════════════════════════════
// NOUVEAUX TOOLS — ACCÈS CODE SOURCE
// ══════════════════════════════════════════════════

read_file                 // Lire le contenu d'un fichier du repo
list_directory            // Lister les fichiers/dossiers d'un répertoire
search_code               // Chercher un pattern (grep) dans le repo
search_codebase_semantic  // Recherche sémantique via embeddings pgvector
get_file_history          // Historique git d'un fichier (derniers commits)
get_repo_structure        // Arborescence du repo (tree condensé)
get_file_blame            // Git blame sur un fichier (qui a écrit quoi)
update_diagnosis          // Mettre à jour le diagnostic du ticket
```

### Définition détaillée des Tools

```typescript
const AGENT_TOOLS: Anthropic.Tool[] = [
  // ── CODE SOURCE ──────────────────────────────────────────
  {
    name: 'read_file',
    description: 'Read the content of a file from the connected GitHub repository. Use this to examine source code, configuration files, or any file in the repo.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path relative to repo root (e.g. "src/services/auth.service.ts")'
        },
        start_line: {
          type: 'number',
          description: 'Optional: start reading from this line (1-indexed)'
        },
        end_line: {
          type: 'number',
          description: 'Optional: stop reading at this line'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory of the repo. Use to understand project structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to repo root (e.g. "src/modules/")'
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list recursively (max 2 levels deep). Default: false'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'search_code',
    description: 'Search for a text pattern across the repository (like grep). Returns matching lines with file paths and line numbers.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text or regex pattern to search for'
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g. "*.ts", "src/**/*.tsx")'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 20)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_codebase_semantic',
    description: 'Semantic search through the indexed codebase using AI embeddings. Best for finding conceptually related code even if exact terms differ.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what you are looking for'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_repo_structure',
    description: 'Get a condensed tree view of the entire repository structure. Use as a first step to understand the project layout.',
    input_schema: {
      type: 'object',
      properties: {
        max_depth: {
          type: 'number',
          description: 'Maximum directory depth (default: 3)'
        },
        exclude_patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude (default: ["node_modules", "dist", ".git", "*.lock"])'
        }
      }
    }
  },
  {
    name: 'get_file_history',
    description: 'Get recent git commit history for a specific file. Shows who changed what and when.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file'
        },
        limit: {
          type: 'number',
          description: 'Number of commits to retrieve (default: 5)'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'get_file_blame',
    description: 'Get git blame information for a file, showing the last author and commit for each line range.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file'
        },
        start_line: { type: 'number' },
        end_line: { type: 'number' }
      },
      required: ['file_path']
    }
  },

  // ── DIAGNOSTIC ────────────────────────────────────────────
  {
    name: 'update_diagnosis',
    description: 'Update the current bug diagnosis with findings from code investigation. Call this after examining relevant code.',
    input_schema: {
      type: 'object',
      properties: {
        root_cause: {
          type: 'string',
          description: 'Identified root cause of the bug'
        },
        affected_files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              relevance: { type: 'string', enum: ['primary', 'secondary', 'context'] },
              description: { type: 'string' }
            }
          },
          description: 'Files involved in the bug'
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0.0-1.0'
        },
        suggested_fix: {
          type: 'string',
          description: 'High-level description of the fix'
        },
        remaining_questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions that still need answers'
        }
      },
      required: ['root_cause', 'confidence']
    }
  },

  // ── TICKET MANAGEMENT (existants, gardés) ─────────────────
  {
    name: 'search_similar_tickets',
    description: 'Search for similar tickets using semantic similarity on past tickets.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_ticket_details',
    description: 'Get full details of a ticket including media and AI analysis.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' }
      },
      required: ['ticket_id']
    }
  },
  {
    name: 'update_ticket_status',
    description: 'Update ticket status.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' },
        status: { type: 'string', enum: ['new', 'open', 'in_progress', 'resolved', 'closed'] }
      },
      required: ['ticket_id', 'status']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate to a human support agent when the issue is too complex or the user requests it.',
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' },
        reason: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
      },
      required: ['ticket_id', 'reason']
    }
  }
];
```

### Implémentation des Tool Handlers (GitHub API)

Chaque tool code-source est implémenté via l'Octokit scopé par installation :

```typescript
// Nouveau service : CodeInvestigationService
@Injectable()
export class CodeInvestigationService {
  constructor(
    private readonly githubAppService: GithubAppService,
    private readonly codebaseSearchService: CodebaseSearchService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Résoudre la config GitHub pour une application
   * Retourne un Octokit scopé + les infos owner/repo
   */
  async getRepoContext(applicationId: string): Promise<RepoContext | null> {
    const config = await this.prisma.projectGithubConfig.findUnique({
      where: { applicationId },
      include: { installation: true }
    });
    if (!config) return null;

    const octokit = await this.githubAppService.getInstallationOctokit(
      Number(config.installation.installationId)
    );

    return {
      octokit,
      owner: config.owner,
      repo: config.repo,
      defaultBranch: config.defaultBranch,
      installationId: config.installation.installationId,
    };
  }

  /**
   * read_file — Lit un fichier via GitHub Contents API
   */
  async readFile(ctx: RepoContext, filePath: string, startLine?: number, endLine?: number): Promise<string> {
    const { data } = await ctx.octokit.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      ref: ctx.defaultBranch,
    });

    if (!('content' in data) || data.encoding !== 'base64') {
      throw new Error(`Cannot read ${filePath}: not a file or too large`);
    }

    let content = Buffer.from(data.content, 'base64').toString('utf-8');

    // Filtrage par lignes si demandé
    if (startLine || endLine) {
      const lines = content.split('\n');
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      content = lines.slice(start, end).join('\n');
    }

    return content;
  }

  /**
   * list_directory — Liste via GitHub Trees API
   */
  async listDirectory(ctx: RepoContext, path: string, recursive: boolean): Promise<TreeEntry[]> {
    const { data: tree } = await ctx.octokit.git.getTree({
      owner: ctx.owner,
      repo: ctx.repo,
      tree_sha: `${ctx.defaultBranch}:${path || ''}`.replace(/:$/, ''),
      recursive: recursive ? 'true' : undefined,
    });

    return tree.tree
      .filter(item => {
        if (recursive) {
          // Limiter à 2 niveaux de profondeur
          const depth = (item.path || '').split('/').length;
          return depth <= 2;
        }
        return true;
      })
      .map(item => ({
        path: item.path || '',
        type: item.type === 'tree' ? 'directory' : 'file',
        size: item.size,
      }));
  }

  /**
   * search_code — Recherche texte via GitHub Code Search API
   */
  async searchCode(ctx: RepoContext, query: string, filePattern?: string, maxResults: number = 20): Promise<CodeSearchHit[]> {
    const q = `${query} repo:${ctx.owner}/${ctx.repo}` +
      (filePattern ? ` path:${filePattern}` : '');

    const { data } = await ctx.octokit.rest.search.code({
      q,
      per_page: Math.min(maxResults, 100),
    });

    return data.items.map(item => ({
      filePath: item.path,
      matchCount: item.text_matches?.length || 0,
      fragments: item.text_matches?.map(m => m.fragment) || [],
    }));
  }

  /**
   * get_repo_structure — Arborescence condensée via recursive tree
   */
  async getRepoStructure(ctx: RepoContext, maxDepth: number = 3, excludePatterns: string[] = []): Promise<string> {
    const defaults = ['node_modules', 'dist', '.git', '*.lock', '.next', 'coverage'];
    const exclude = [...defaults, ...excludePatterns];

    const { data: tree } = await ctx.octokit.git.getTree({
      owner: ctx.owner,
      repo: ctx.repo,
      tree_sha: ctx.defaultBranch,
      recursive: 'true',
    });

    // Filtrer et formater en arborescence
    const filtered = tree.tree.filter(item => {
      const path = item.path || '';
      const depth = path.split('/').length;
      if (depth > maxDepth) return false;
      return !exclude.some(pattern => {
        if (pattern.startsWith('*')) return path.endsWith(pattern.slice(1));
        return path.includes(pattern);
      });
    });

    return this.formatAsTree(filtered);
  }

  /**
   * get_file_history — Derniers commits d'un fichier
   */
  async getFileHistory(ctx: RepoContext, filePath: string, limit: number = 5): Promise<CommitInfo[]> {
    const { data: commits } = await ctx.octokit.repos.listCommits({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      per_page: limit,
    });

    return commits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name || 'Unknown',
      date: c.commit.author?.date || '',
    }));
  }

  /**
   * search_codebase_semantic — Wrapper sur CodebaseSearchService existant
   */
  async searchSemantic(applicationId: string, query: string, limit: number = 10) {
    return this.codebaseSearchService.findRelevantFiles(applicationId, query, limit);
  }
}
```

---

## 3. Nouveau AgentService — Architecture

### Principe : Agentic Loop (pas state machine rigide)

On remplace la state machine linéaire par une **boucle agentique** Anthropic :

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   System Prompt (contexte ticket + instructions)    │
│                          │                          │
│                          ▼                          │
│   ┌─────────────────────────────────────────┐       │
│   │       Anthropic claude-sonnet-4         │       │
│   │       avec 12 tools disponibles         │       │
│   └──────────────┬──────────────────────────┘       │
│                  │                                   │
│          ┌───────┴────────┐                          │
│          │                │                          │
│     Tool calls?     Text response?                   │
│          │                │                          │
│          ▼                ▼                          │
│   Execute tools    Return to user                    │
│   (read_file,      (diagnostic,                     │
│    search_code,    réponse chat)                     │
│    etc.)                                             │
│          │                                           │
│          ▼                                           │
│   Append results                                     │
│   to conversation                                    │
│          │                                           │
│          └──────────► Loop back ◄────────────────── │
│                                                     │
└─────────────────────────────────────────────────────┘
```

L'agent décide lui-même quels fichiers lire, dans quel ordre, et quand il a assez d'information pour répondre. Pas de state machine artificielle — c'est Claude qui raisonne.

### System Prompt de l'agent

```typescript
function buildAgentSystemPrompt(ticket: Ticket, repoStructure: string): string {
  return `You are an expert software engineer acting as an AI support agent.
You have full access to the codebase through your tools.

## Your Mission
When a bug report or support ticket arrives, your job is to:
1. Understand the issue thoroughly
2. Investigate the codebase to find the root cause
3. Provide a precise, code-level diagnosis
4. Suggest concrete fixes with file paths and line numbers

## Available Context
- Ticket title: ${ticket.title}
- Description: ${ticket.description}
- AI Summary: ${ticket.aiSummary || 'Not yet analyzed'}
- Type: ${ticket.type || 'Unknown'} (confidence: ${ticket.typeConfidence || 'N/A'})
- Severity: ${ticket.severity || 'Unknown'}
- Keywords: ${ticket.keywords?.join(', ') || 'None'}
${ticket.reproductionSteps ? `- Reproduction steps: ${JSON.stringify(ticket.reproductionSteps)}` : ''}

## Repository Structure (condensed)
${repoStructure}

## Investigation Strategy
1. Start with get_repo_structure if you need to understand the project layout
2. Use search_codebase_semantic to find code related to the bug description
3. Use search_code for exact text/pattern matching
4. Use read_file to examine specific files in detail
5. Use get_file_history to check recent changes that might have caused the bug
6. Use get_file_blame to identify who last touched relevant code
7. Call update_diagnosis when you have findings

## Communication Style
- Be precise: reference exact file paths and line numbers
- Be honest about confidence levels
- If you need information from the user, explain what you need and why
- Show relevant code snippets in your explanations
- When you identify the root cause, explain the chain of events that leads to the bug

## Rules
- Always investigate the code before making claims about root cause
- Never guess about code structure — use your tools to verify
- If the codebase is not indexed, use read_file and list_directory directly
- Keep tool calls efficient — don't read files you don't need`;
}
```

### Flow de la Deep Analysis (Phase 1 — automatique)

Quand un ticket arrive, avant même que l'utilisateur ne parle à l'agent :

```typescript
async runDeepAnalysis(ticketId: string, tenantId: string): Promise<Diagnosis> {
  // 1. Charger le ticket avec son application et config GitHub
  const ticket = await this.loadTicketWithContext(ticketId);
  const repoCtx = await this.codeInvestigation.getRepoContext(ticket.applicationId);

  if (!repoCtx) {
    // Pas de repo connecté : analyse basique (comme aujourd'hui)
    return this.runBasicAnalysis(ticket, tenantId);
  }

  // 2. Récupérer la structure du repo (cachée en Redis, TTL 1h)
  const repoStructure = await this.getOrCacheRepoStructure(repoCtx, ticket.applicationId);

  // 3. Construire le system prompt avec le contexte complet
  const systemPrompt = buildAgentSystemPrompt(ticket, repoStructure);

  // 4. Message initial demandant l'investigation
  const userPrompt = `A new ticket has been submitted. Please investigate the codebase to find the root cause.

Ticket: "${ticket.title}"
${ticket.description ? `Description: ${ticket.description}` : ''}
${ticket.aiSummary ? `AI Summary: ${ticket.aiSummary}` : ''}

Start by identifying which parts of the codebase are likely involved, then read the relevant files to understand the bug. Call update_diagnosis when you have findings.`;

  // 5. Lancer la boucle agentique Anthropic
  const result = await this.runAgenticLoop({
    systemPrompt,
    initialMessage: userPrompt,
    tools: AGENT_TOOLS,
    repoCtx,
    ticket,
    tenantId,
    maxIterations: 15,       // Laisser l'agent faire jusqu'à 15 tool calls
    maxTokens: 4096,
  });

  // 6. Extraire le diagnostic du dernier update_diagnosis call
  const diagnosis = this.extractDiagnosis(result.toolCallLog);

  // 7. Persister le diagnostic
  await this.saveDiagnosis(ticketId, tenantId, diagnosis, result);

  return diagnosis;
}
```

### Boucle Agentique Anthropic (remplace runWithFunctionCalling)

```typescript
async runAgenticLoop(options: AgenticLoopOptions): Promise<AgenticLoopResult> {
  const { systemPrompt, initialMessage, tools, repoCtx, ticket, tenantId, maxIterations, maxTokens } = options;

  const anthropic = await this.getAnthropicClient(tenantId);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: initialMessage }
  ];

  const toolCallLog: ToolCallResult[] = [];
  let iterations = 0;
  let finalContent = '';

  while (iterations < maxIterations) {
    iterations++;

    // Appel Anthropic avec tool_use
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // ou le model du tenant
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      tools,
    });

    // Vérifier si la réponse contient des tool_use blocks
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const textBlocks = response.content.filter(b => b.type === 'text');

    // Ajouter le message assistant à l'historique
    messages.push({ role: 'assistant', content: response.content });

    // Si pas de tool calls → réponse finale
    if (toolUseBlocks.length === 0) {
      finalContent = textBlocks.map(b => b.text).join('\n');
      break;
    }

    // Exécuter chaque tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      let result: unknown;
      let error: string | undefined;

      try {
        result = await this.executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          repoCtx,
          ticket,
          tenantId
        );
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
        result = { error };
      }

      toolCallLog.push({
        toolCallId: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
        result,
        error,
        durationMs: Date.now() - startTime,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
        is_error: !!error,
      });
    }

    // Ajouter les résultats des tools à l'historique
    messages.push({ role: 'user', content: toolResults });

    // Check stop_reason
    if (response.stop_reason === 'end_turn') {
      finalContent = textBlocks.map(b => b.text).join('\n');
      break;
    }
  }

  return { finalContent, toolCallLog, iterations, messages };
}
```

### Flow conversationnel (Phase 2 — quand l'utilisateur parle)

```typescript
async handleUserMessage(
  sessionId: string,
  message: string,
  tenantId: string
): Promise<AgentResponse> {
  // 1. Charger la session avec tout le contexte
  const session = await this.loadSession(sessionId);
  const ticket = await this.loadTicketWithContext(session.ticketId);
  const repoCtx = await this.codeInvestigation.getRepoContext(ticket.applicationId);
  const diagnosis = await this.loadDiagnosis(session.ticketId);

  // 2. Reconstruire l'historique de conversation
  const conversationHistory = await this.buildConversationHistory(sessionId);

  // 3. System prompt enrichi avec le diagnostic existant
  const repoStructure = repoCtx
    ? await this.getOrCacheRepoStructure(repoCtx, ticket.applicationId)
    : 'No repository connected';

  const systemPrompt = buildAgentSystemPrompt(ticket, repoStructure)
    + (diagnosis ? `\n\n## Current Diagnosis\n${JSON.stringify(diagnosis, null, 2)}` : '');

  // 4. Ajouter le message utilisateur
  conversationHistory.push({ role: 'user', content: message });

  // 5. Lancer la boucle agentique (l'agent peut relire du code si besoin)
  const result = await this.runAgenticLoop({
    systemPrompt,
    initialMessage: message,  // sera ajouté après l'historique
    tools: AGENT_TOOLS,
    repoCtx,
    ticket,
    tenantId,
    maxIterations: 10,
    maxTokens: 4096,
    existingMessages: conversationHistory, // Passer l'historique
  });

  // 6. Sauvegarder le message agent
  await this.saveAgentMessage(sessionId, result.finalContent, result.toolCallLog);

  // 7. Mettre à jour le diagnostic si update_diagnosis a été appelé
  const updatedDiagnosis = this.extractDiagnosis(result.toolCallLog);
  if (updatedDiagnosis) {
    await this.saveDiagnosis(session.ticketId, tenantId, updatedDiagnosis, result);
  }

  // 8. Émettre via WebSocket pour le temps réel
  this.emitAgentResponse(session.ticketId, result.finalContent);

  return {
    content: result.finalContent,
    toolsUsed: result.toolCallLog.map(t => t.name),
    diagnosis: updatedDiagnosis || diagnosis,
  };
}
```

---

## 4. Corrélation Vidéo ↔ Code

Le pipeline vidéo existant (FFmpeg → OCR → GPT-4 Vision) est enrichi :

```
Video frames + OCR text
        │
        ▼
┌─────────────────────────────────────────┐
│  Extraction d'indices visuels :         │
│  - Noms de composants/classes visibles  │
│  - Messages d'erreur (stack traces)     │
│  - URLs/routes affichées                │
│  - Texte de boutons/labels              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Mapping vers le code source :          │
│  - OCR "TypeError: cannot read..."      │
│    → search_code("TypeError") dans repo │
│  - URL "/dashboard/tickets"             │
│    → search_code("/dashboard/tickets")  │
│  - Composant "TicketTable"              │
│    → search_code("TicketTable")         │
│  - Error boundary "ChunkLoadError"      │
│    → search_code("ChunkLoadError")      │
└─────────────────────────────────────────┘
```

Concrètement, le system prompt de l'agent inclut les informations vidéo :

```typescript
// Dans buildAgentSystemPrompt, si le ticket a des media avec OCR :
const videoContext = ticket.media?.flatMap(m =>
  m.videoEvents
    ?.filter(e => e.ocrText)
    .map(e => `[${e.timestampMs}ms] ${e.ocrText}`)
) || [];

if (videoContext.length > 0) {
  systemPrompt += `\n\n## Video Analysis (OCR extracted text)\n`;
  systemPrompt += videoContext.join('\n');
  systemPrompt += `\n\nUse these visual cues to search for related code in the repository.`;
}
```

---

## 5. Codebase Indexing amélioré

### Indexation initiale (quand le repo est connecté)

Le `codebase-indexing.worker.ts` existant est amélioré :

```typescript
// Nouveau flow d'indexation
async indexRepository(applicationId: string) {
  const repoCtx = await this.codeInvestigation.getRepoContext(applicationId);

  // 1. Récupérer l'arbre complet du repo
  const tree = await repoCtx.octokit.git.getTree({
    owner: repoCtx.owner,
    repo: repoCtx.repo,
    tree_sha: repoCtx.defaultBranch,
    recursive: 'true',
  });

  // 2. Filtrer les fichiers indexables
  const indexableFiles = tree.data.tree.filter(item =>
    item.type === 'blob' &&
    this.isIndexableFile(item.path) && // .ts, .tsx, .js, .py, .go, etc.
    (item.size || 0) < 100_000 // Skip files > 100KB
  );

  // 3. Pour chaque fichier : lire → chunker → embed → stocker
  for (const batch of chunk(indexableFiles, 10)) {
    await Promise.all(batch.map(async file => {
      const content = await this.codeInvestigation.readFile(repoCtx, file.path);
      const chunks = this.codeChunker.chunkFile(file.path, content);

      for (const chunk of chunks) {
        const embedding = await this.aiService.generateEmbedding(
          `${file.path}\n${chunk.content}`
        );

        await this.prisma.codebaseEmbedding.upsert({
          where: {
            applicationId_filePath_chunkIndex: {
              applicationId,
              filePath: file.path,
              chunkIndex: chunk.index,
            }
          },
          create: {
            tenantId: repoCtx.tenantId,
            applicationId,
            filePath: file.path,
            chunkIndex: chunk.index,
            content: chunk.content,
            language: this.detectLanguage(file.path),
            lastCommitSha: 'HEAD',
            metadata: { functions: chunk.functions, classes: chunk.classes },
          },
          update: {
            content: chunk.content,
            lastCommitSha: 'HEAD',
          }
        });

        // Raw SQL pour le vector (Prisma ne supporte pas nativement)
        await this.prisma.$executeRaw`
          UPDATE codebase_embeddings
          SET embedding = ${`[${embedding.join(',')}]`}::vector
          WHERE application_id = ${applicationId}::uuid
            AND file_path = ${file.path}
            AND chunk_index = ${chunk.index}
        `;
      }
    }));
  }
}
```

### Indexation incrémentale (webhook push)

Quand un push est reçu sur le repo, on re-indexe uniquement les fichiers modifiés :

```typescript
// Dans github-webhook.processor.ts
async handlePushEvent(payload: PushWebhookPayload) {
  const modifiedFiles = [
    ...payload.commits.flatMap(c => c.added),
    ...payload.commits.flatMap(c => c.modified),
  ];
  const deletedFiles = payload.commits.flatMap(c => c.removed);

  // Re-indexer les fichiers modifiés
  for (const filePath of [...new Set(modifiedFiles)]) {
    await this.indexingQueue.add('reindex-file', {
      applicationId,
      filePath,
      commitSha: payload.after,
    });
  }

  // Supprimer les embeddings des fichiers supprimés
  for (const filePath of [...new Set(deletedFiles)]) {
    await this.prisma.codebaseEmbedding.deleteMany({
      where: { applicationId, filePath }
    });
  }
}
```

---

## 6. Modifications au schéma Prisma

```prisma
// Ajout au model Ticket — stocker le diagnostic structuré
model Ticket {
  // ... champs existants ...

  // Nouveau : diagnostic structuré par l'agent
  diagnosis          Json?     @map("diagnosis") @db.JsonB
  diagnosisUpdatedAt DateTime? @map("diagnosis_updated_at")
}

// Ajout au model AgentSession — stocker la conversation complète Anthropic
model AgentSession {
  // ... champs existants ...

  // Nouveau : historique des messages Anthropic (pour reprendre la conversation)
  anthropicMessages  Json?     @map("anthropic_messages") @db.JsonB
  toolCallLog        Json?     @map("tool_call_log") @db.JsonB
}

// Ajout au model AgentTask — lier au diagnostic
model AgentTask {
  // ... champs existants ...

  // Nouveau : référence au diagnostic qui a généré la tâche
  diagnosisSnapshot  Json?     @map("diagnosis_snapshot") @db.JsonB
}
```

---

## 7. Impact sur le frontend (Dashboard)

### Page ticket détail — Nouvelle section "AI Diagnosis"

```
┌─────────────────────────────────────────────────────────┐
│  Ticket: "Login button doesn't work on mobile"          │
│  Status: In Progress │ Severity: High │ Type: Bug       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📋 Description           🎥 Video                      │
│  ...                      [Player]                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  🔍 AI Diagnosis                        Confidence: 87% │
│                                                         │
│  Root Cause:                                            │
│  The onClick handler in LoginButton.tsx (line 42) calls │
│  handleSubmit() which relies on window.innerWidth to    │
│  detect mobile, but the check uses < 768 while the CSS │
│  breakpoint is at 640px, creating a dead zone.          │
│                                                         │
│  Affected Files:                                        │
│  • src/components/auth/LoginButton.tsx (primary)        │
│  • src/styles/breakpoints.ts (secondary)                │
│  • src/hooks/useResponsive.ts (context)                 │
│                                                         │
│  Suggested Fix:                                         │
│  Align the JS breakpoint check with the CSS value       │
│  (640px) or use the useResponsive hook consistently.    │
│                                                         │
│  [🤖 Generate Fix]  [💬 Ask Agent]  [👤 Escalate]       │
├─────────────────────────────────────────────────────────┤
│  💬 Agent Chat                                          │
│                                                         │
│  Agent: I've analyzed the codebase and found that the   │
│  issue is in LoginButton.tsx. The mobile detection...   │
│                                                         │
│  You: Can you also check if this affects the signup     │
│  page?                                                  │
│                                                         │
│  Agent: Good question. Let me check...                  │
│  [reading src/components/auth/SignupButton.tsx...]       │
│  Yes, SignupButton.tsx has the same pattern at line 38.  │
│  Both files should be fixed together.                   │
│                                                         │
│  [Message input...]                          [Send]     │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Résumé des fichiers à créer/modifier

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `apps/api/src/modules/agent-v2/code-investigation.service.ts` | Service d'accès au code via GitHub API |
| `apps/api/src/modules/agent-v2/agentic-loop.service.ts` | Boucle agentique Anthropic avec tool_use |
| `apps/api/src/modules/agent-v2/agent-tools.ts` | Définitions des 12 tools Anthropic |
| `apps/api/src/modules/agent-v2/tool-executor.service.ts` | Dispatch et exécution des tools |
| `apps/api/src/modules/agent-v2/diagnosis.service.ts` | Gestion du diagnostic structuré |
| `apps/api/src/modules/agent-v2/agent-v2.module.ts` | Module NestJS |
| `apps/api/src/modules/agent-v2/agent-v2.controller.ts` | Endpoints REST pour le chat |
| `apps/api/src/modules/agent-v2/agent-v2.gateway.ts` | WebSocket pour le temps réel |
| `apps/worker/src/workers/deep-analysis.worker.ts` | Worker BullMQ pour l'analyse automatique |
| `apps/dashboard/components/diagnosis/DiagnosisPanel.tsx` | UI du diagnostic |
| `apps/dashboard/components/agent-chat/AgentChatV2.tsx` | Chat agent avec code context |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `apps/api/prisma/schema.prisma` | Ajout champs diagnosis, anthropicMessages |
| `apps/api/src/app.module.ts` | Import AgentV2Module |
| `apps/api/src/modules/tickets/tickets.service.ts` | Trigger deep analysis après création |
| `apps/worker/src/workers/agent.worker.ts` | Déléguer au nouveau service pour les nouveaux types |
| `apps/worker/src/workers/codebase-indexing.worker.ts` | Améliorer l'indexation |
| `apps/api/src/modules/github/processors/github-webhook.processor.ts` | Indexation incrémentale sur push |

---

## 9. Gestion des limites et coûts

### Rate limiting des appels GitHub API

- GitHub API : 5000 req/h par installation → cache Redis agressif
- `get_repo_structure` : caché 1h en Redis
- `read_file` : caché 10min (invalidé par webhook push)
- `search_code` : pas de cache (résultats dépendent de la query)

### Rate limiting des appels Anthropic

- Deep analysis : max 15 tool calls par ticket
- Conversation : max 10 tool calls par message
- Timeout global : 2 minutes par analyse, 30s par message conversationnel

### Coûts estimés

- Deep analysis (~15 tool calls) : ~$0.05-0.10 par ticket (Sonnet)
- Message conversationnel (~5 tool calls) : ~$0.02-0.05 par message
- Indexation repo (1000 fichiers) : ~$2-5 en embeddings (one-time)

# Roadmap : Agent IA Support Automatisé — Workflow Complet

> **Statut du diagnostic (2026-02-20)**
>
> L'infrastructure est déjà opérationnelle : GitHub App Auth (`GithubAppService`), boucle agentique
> (`AgenticLoopService`), outils de lecture (`CodeInvestigationService`), dispatching (`ToolExecutorService`).
>
> **Deux problèmes bloquants identifiés :**
> 1. **Config manquante** — Si `GithubInstallation` ou `ProjectGithubConfig` sont absents en DB,
>    tous les outils retournent `"No repository connected"` silencieusement. **Vérifier US-00 avant tout.**
> 2. **Outils write absents** — L'agent ne peut pas créer de branche, écrire des fichiers, ni ouvrir
>    de PR. Les US-01/02/03 ajoutent exactement ce qui manque.

---

## US-00 — Vérification et setup de la configuration GitHub (PRÉ-REQUIS)

**Priorité :** Critique — à faire AVANT d'implémenter quoi que ce soit d'autre
**Aucun fichier de code à modifier** — c'est une checklist de configuration

### Pourquoi l'agent répond "No repository connected"

Quand l'agent reçoit un message dans le chat, voici le flux exact :

```
handleUserMessage(sessionId)
    │
    ▼
getRepoContext(ticket.applicationId)
    │
    ▼
prisma.projectGithubConfig.findFirst({ where: { applicationId } })
    │
    ├── trouvé → Octokit authentifié → lecture repo ✅
    └── null   → retourne null
                    │
                    ▼
             tous les outils retournent :
             "No repository connected to this application.
              Connect a GitHub repo in Settings > GitHub." ❌
```

Aucune erreur n'est levée — l'agent continue à tourner mais **chaque appel d'outil échoue silencieusement**.

### Checklist — 3 prérequis en DB et env

Pour que l'agent accède au repo, ces 3 choses doivent exister :

```
1. Variables d'env dans .env.local
       GITHUB_APP_ID=          ← ID numérique de la GitHub App
       GITHUB_APP_NAME=        ← slug de la GitHub App (ex: "mon-app-support")
       GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
       MIIEow...
       -----END RSA PRIVATE KEY-----"

2. GithubInstallation en DB  ← créé via le callback OAuth
       installationId  (BigInt)
       tenantId
       accountLogin    (ex: "KJ-devs")

3. ProjectGithubConfig en DB  ← créé en liant le repo à l'Application
       applicationId   ← DOIT matcher l'applicationId du ticket
       installationId  ← ref vers GithubInstallation
       owner           (ex: "KJ-devs")
       repo            (ex: "supportHelperV2")
       defaultBranch   (ex: "main")
```

### Étape 1 — Vérifier l'état actuel en base

Ouvrir Prisma Studio (`pnpm db:studio`) ou lancer directement :

```sql
-- Est-ce qu'une installation GitHub existe ?
SELECT * FROM github_installations;

-- Est-ce qu'un repo est lié à une application ?
SELECT pgc.*, a.name as app_name
FROM project_github_configs pgc
JOIN applications a ON a.id = pgc.application_id;

-- Est-ce que le ticket utilisé dans le chat a bien un applicationId lié ?
SELECT t.id, t.title, t.application_id, pgc.owner, pgc.repo
FROM tickets t
LEFT JOIN project_github_configs pgc ON pgc.application_id = t.application_id
WHERE t.id = '<ticket_id_utilisé_dans_le_chat>';
```

**Si `github_installations` est vide** → faire l'Étape 2.
**Si `project_github_configs` est vide** → faire l'Étape 3.
**Si le ticket n'a pas de `project_github_config` associé** → faire l'Étape 3 pour la bonne application.

### Étape 2 — Créer et installer la GitHub App (si pas encore fait)

1. Aller sur https://github.com/settings/apps/new
2. Remplir :
   - **GitHub App name** : nom unique (ex: `support-helper-dev`)
   - **Homepage URL** : `http://localhost:3001`
   - **Callback URL** : `http://localhost:3001/api/github/install/callback`
   - **Webhook** : désactiver pour commencer
3. Permissions requises :
   - `Contents: Read & Write`
   - `Pull requests: Read & Write`
   - `Metadata: Read-only`
4. Cliquer "Create GitHub App"
5. Sur la page de l'app créée, récupérer :
   - **App ID** (numérique, en haut de page)
   - **App Name** (le slug utilisé dans les URLs)
   - Générer une **Private Key** (bouton en bas) → télécharge un fichier `.pem`
6. Remplir `.env.local` :

```bash
GITHUB_APP_ID=123456
GITHUB_APP_NAME=support-helper-dev
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEow...contenu du fichier .pem...
-----END RSA PRIVATE KEY-----"
```

7. Redémarrer l'API : `pnpm --filter @support-helper/api dev`
8. Dans le dashboard → Settings → GitHub → cliquer "Install GitHub App"
   → sélectionner le repo `supportHelperV2` → confirmer
   → le callback crée l'enregistrement `GithubInstallation` en DB ✅

### Étape 3 — Lier le repo à l'Application (si pas encore fait)

L'`applicationId` sur le ticket doit avoir un `ProjectGithubConfig` associé.

1. Dans le dashboard → Applications → sélectionner l'application utilisée pour les tickets
2. Onglet GitHub → "Connect Repository"
3. Sélectionner l'installation → sélectionner `KJ-devs/supportHelperV2`
4. Confirmer → appel `POST /api/applications/:id/github/connect` → crée `ProjectGithubConfig` ✅

### Étape 4 — Valider que l'agent lit bien le repo

Créer un ticket avec cette application, ouvrir le chat de l'agent, envoyer :

```
List the root directory of the connected repository.
```

L'agent doit appeler `get_repo_structure` ou `list_directory` et retourner l'arborescence.
Si ça retourne encore `"No repository connected"` → re-vérifier la requête SQL de l'Étape 1
et s'assurer que `ticket.application_id === projectGithubConfig.application_id`.

---

## Architecture cible

```
Ticket soumis
    │
    ▼
[DeepAnalysisService.analyze()]        ← déjà fonctionnel
    │  lit le repo, identifie la cause racine
    ▼
[AgenticLoopService.run()]             ← déjà fonctionnel
    │  boucle Claude Sonnet + outils
    │
    ├─ read_file / search_code / ...   ← déjà implémentés
    │
    └─ create_branch                   ← US-01 : à ajouter
       write_file                      ← US-01 : à ajouter
       create_pull_request             ← US-01 : à ajouter
            │
            ▼
    [PR créée sur GitHub]
    ticket.status = 'fix_proposed'     ← US-02 : statut + event
    [Notification Dashboard]           ← US-02 : WebSocket
```

---

## US-01 — Outils d'écriture GitHub pour l'agent

**Priorité :** Critique — bloquant toute capacité de fix automatique
**Fichiers à modifier :**
- `apps/api/src/modules/agent-v2/agent-tools.ts`
- `apps/api/src/modules/agent-v2/tool-executor.service.ts`
- `apps/api/src/modules/agent-v2/code-investigation.service.ts`

### Contexte technique exact

`CodeInvestigationService` contient un `RepoContext` qui expose un `octokit: Octokit` authentifié via
`GithubAppService.getInstallationOctokit()`. Les méthodes d'écriture Octokit nécessaires existent déjà
dans `@octokit/rest` (déjà installé) :
- `octokit.git.createRef()` → créer une branche
- `octokit.repos.createOrUpdateFileContents()` → écrire un fichier (requiert le SHA si le fichier existe)
- `octokit.pulls.create()` → ouvrir une PR

### Tâche 1 : Ajouter 3 méthodes d'écriture à `CodeInvestigationService`

**Fichier :** `apps/api/src/modules/agent-v2/code-investigation.service.ts`

Ajouter ces 3 méthodes publiques à la classe `CodeInvestigationService` (après la méthode `getFileBlame`) :

```typescript
/**
 * Create a new branch from a base branch.
 * Returns the new branch's ref SHA.
 */
async createBranch(
  ctx: RepoContext,
  branchName: string,
  fromBranch?: string,
): Promise<{ ref: string; sha: string }> {
  const base = fromBranch ?? ctx.defaultBranch;

  // Get base branch SHA
  const { data: baseRef } = await ctx.octokit.git.getRef({
    owner: ctx.owner,
    repo: ctx.repo,
    ref: `heads/${base}`,
  });

  const sha = baseRef.object.sha;

  await ctx.octokit.git.createRef({
    owner: ctx.owner,
    repo: ctx.repo,
    ref: `refs/heads/${branchName}`,
    sha,
  });

  this.logger.log(`Created branch ${branchName} from ${base} (${sha.substring(0, 7)})`);
  return { ref: `refs/heads/${branchName}`, sha };
}

/**
 * Write or update a file on a branch.
 * Automatically fetches the current file SHA if the file already exists.
 */
async writeFile(
  ctx: RepoContext,
  branch: string,
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<{ commitSha: string; url: string }> {
  // Try to get current file SHA (required for updates)
  let fileSha: string | undefined;
  try {
    const { data: existing } = await ctx.octokit.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: filePath,
      ref: branch,
    });
    if ('sha' in existing) {
      fileSha = existing.sha;
    }
  } catch {
    // File does not exist yet — creation, no SHA needed
  }

  const { data } = await ctx.octokit.repos.createOrUpdateFileContents({
    owner: ctx.owner,
    repo: ctx.repo,
    path: filePath,
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    ...(fileSha ? { sha: fileSha } : {}),
  });

  // Invalidate cache for this file
  const cacheKey = `repo-file:${ctx.applicationId}:${filePath}:${ctx.defaultBranch}`;
  await this.cacheService.del(cacheKey);

  this.logger.log(`Wrote ${filePath} on branch ${branch} (commit ${data.commit.sha?.substring(0, 7)})`);
  return {
    commitSha: data.commit.sha ?? '',
    url: data.content?.html_url ?? '',
  };
}

/**
 * Create a Pull Request.
 */
async createPullRequest(
  ctx: RepoContext,
  title: string,
  body: string,
  headBranch: string,
  baseBranch?: string,
): Promise<{ number: number; url: string; id: number }> {
  const base = baseBranch ?? ctx.defaultBranch;

  const { data } = await ctx.octokit.pulls.create({
    owner: ctx.owner,
    repo: ctx.repo,
    title,
    body,
    head: headBranch,
    base,
  });

  this.logger.log(`Created PR #${data.number}: ${title} (${headBranch} → ${base})`);
  return { number: data.number, url: data.html_url, id: data.id };
}
```

### Tâche 2 : Déclarer les 3 nouveaux outils dans `agent-tools.ts`

**Fichier :** `apps/api/src/modules/agent-v2/agent-tools.ts`

**Étape 2a** — Ajouter les 3 noms au type `ToolName` :

```typescript
// Remplacer la ligne de type ToolName existante par :
export type ToolName =
  | 'read_file'
  | 'list_directory'
  | 'search_code'
  | 'search_codebase_semantic'
  | 'get_repo_structure'
  | 'get_file_history'
  | 'get_file_blame'
  | 'list_repos'
  | 'update_diagnosis'
  | 'search_similar_tickets'
  | 'get_ticket_details'
  | 'update_ticket_status'
  | 'escalate_to_human'
  | 'create_branch'      // NEW
  | 'write_file'         // NEW
  | 'create_pull_request'; // NEW
```

**Étape 2b** — Ajouter ces 3 outils à la fin du tableau `AGENT_TOOLS` (avant la fermeture `]`) :

```typescript
  // ── WRITE / FIX ──────────────────────────────────────────
  {
    name: 'create_branch',
    description:
      'Create a new Git branch in the connected repository. Always create a branch before writing files. Use a descriptive name like "fix/ticket-123-null-pointer" or "fix/auth-token-expiry".',
    input_schema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description: 'Branch name, e.g. "fix/ticket-123-login-error". Use kebab-case.',
        },
        from_branch: {
          type: 'string',
          description: 'Base branch to branch from (default: repo default branch, usually "main" or "master").',
        },
        repo: {
          type: 'string',
          description: 'Optional: target repository in "owner/repo" format.',
        },
      },
      required: ['branch_name'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write or update a file on a specific branch. Use this to apply fixes to source code. IMPORTANT: Always call create_branch first — never write directly to the default branch.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path relative to repo root, e.g. "src/services/auth.service.ts".',
        },
        content: {
          type: 'string',
          description: 'Complete new file content (not a diff — full file).',
        },
        branch: {
          type: 'string',
          description: 'Branch to write to. Must exist (create it first with create_branch).',
        },
        commit_message: {
          type: 'string',
          description: 'Git commit message. Follow conventional commits: "fix(scope): description".',
        },
        repo: {
          type: 'string',
          description: 'Optional: target repository in "owner/repo" format.',
        },
      },
      required: ['file_path', 'content', 'branch', 'commit_message'],
    },
  },
  {
    name: 'create_pull_request',
    description:
      'Open a Pull Request on GitHub with the fix. Call this after all files have been written. Include a detailed description explaining the root cause and the fix.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'PR title, e.g. "fix(auth): resolve null token on refresh".',
        },
        body: {
          type: 'string',
          description: 'PR description in Markdown. Include: root cause, files changed, how to test.',
        },
        head_branch: {
          type: 'string',
          description: 'The branch that contains the fix.',
        },
        base_branch: {
          type: 'string',
          description: 'Target branch to merge into (default: repo default branch).',
        },
        repo: {
          type: 'string',
          description: 'Optional: target repository in "owner/repo" format.',
        },
      },
      required: ['title', 'body', 'head_branch'],
    },
  },
```

### Tâche 3 : Implémenter le dispatch dans `ToolExecutorService`

**Fichier :** `apps/api/src/modules/agent-v2/tool-executor.service.ts`

Ajouter 3 cases dans le `switch` de `dispatchTool`, avant le bloc `default` :

```typescript
      case 'create_branch': {
        const ctx = await this.resolveRepoContext(input, context);
        if (!ctx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.createBranch(
          ctx,
          input.branch_name as string,
          input.from_branch as string | undefined,
        );
      }

      case 'write_file': {
        const ctx = await this.resolveRepoContext(input, context);
        if (!ctx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.writeFile(
          ctx,
          input.branch as string,
          input.file_path as string,
          input.content as string,
          input.commit_message as string,
        );
      }

      case 'create_pull_request': {
        const ctx = await this.resolveRepoContext(input, context);
        if (!ctx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.createPullRequest(
          ctx,
          input.title as string,
          input.body as string,
          input.head_branch as string,
          input.base_branch as string | undefined,
        );
      }
```

### Tâche 4 : Mettre à jour le system prompt de l'agent

**Fichier :** `apps/api/src/modules/agent-v2/deep-analysis.service.ts`

Dans la méthode `buildAgentSystemPrompt`, remplacer la section `## Rules` et ajouter la phase de fix :

```typescript
// Remplacer le bloc ## Rules ... (fin de la méthode buildAgentSystemPrompt) par :

## Investigation Strategy
1. Start with get_repo_structure to understand the project layout
2. Use search_codebase_semantic to find code related to the bug description
3. Use search_code for exact text/pattern matching
4. Use read_file to examine specific files in detail
5. Use get_file_history to check recent changes that may have caused the bug
6. Call update_diagnosis with your findings (root_cause, affected_files, confidence)

## Fix Strategy (only when confidence >= 0.7)
7. Call create_branch with a descriptive name: "fix/ticket-{ticketId}-{short-description}"
8. Call write_file for each file that needs to be modified (provide the FULL file content)
9. Call create_pull_request with:
   - Title: "fix(scope): description" format
   - Body: ## Root Cause, ## Changes Made, ## How to Test sections

## Rules
- ALWAYS investigate the code before making claims about root cause
- NEVER guess about code structure — verify with tools
- NEVER write to the default branch — always use create_branch first
- NEVER provide partial file content in write_file — always the full file
- If confidence < 0.7, call update_diagnosis and escalate_to_human instead of writing
- If the fix spans more than 5 files, call escalate_to_human — too risky to auto-fix
- Keep write_file calls atomic: one logical change per commit message
```

### Validation de l'US-01

Une fois implémenté, tester manuellement en créant un ticket avec un repo GitHub connecté et en demandant à l'agent de fixer un bug simple. Vérifier dans le dashboard GitHub que :
- [ ] Une branche `fix/ticket-{id}-...` a été créée
- [ ] Le fichier modifié est committé sur cette branche
- [ ] Une PR est ouverte avec un titre et une description

---

## US-02 — Statut `fix_proposed` et notification temps réel

**Priorité :** Haute — sans ça, l'équipe ne sait pas qu'une PR a été créée
**Fichiers à modifier :**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/agent-v2/deep-analysis.service.ts`
- `apps/api/src/modules/agent-v2/tool-executor.service.ts`

### Tâche 1 : Ajouter le statut `fix_proposed` au schéma Prisma

**Fichier :** `apps/api/prisma/schema.prisma`

Trouver l'enum ou le champ `status` sur le modèle `Ticket` et ajouter `fix_proposed` :

```prisma
// Si status est une String avec commentaire d'enum, ajouter dans les commentaires :
// Statuts valides : new | open | in_progress | analyzing | analyzed | analysis_failed
//                  | fix_proposed | resolved | closed
```

> **Note :** Si `status` est un champ `String` libre (pas un `enum` Prisma), il suffit de l'utiliser
> directement dans le code — pas de migration requise. Vérifier d'abord le schéma.

### Tâche 2 : Mettre à jour le statut du ticket quand `create_pull_request` est appelé

**Fichier :** `apps/api/src/modules/agent-v2/tool-executor.service.ts`

Dans le case `create_pull_request` déjà ajouté en US-01, enrichir le retour pour déclencher
la mise à jour du ticket :

```typescript
      case 'create_pull_request': {
        const ctx = await this.resolveRepoContext(input, context);
        if (!ctx) return { error: NO_REPO_ERROR };

        const pr = await this.codeInvestigation.createPullRequest(
          ctx,
          input.title as string,
          input.body as string,
          input.head_branch as string,
          input.base_branch as string | undefined,
        );

        // Update ticket status to fix_proposed
        await this.prisma.ticket.update({
          where: { id: context.ticket.id },
          data: {
            status: 'fix_proposed',
            diagnosis: {
              ...(context.ticket as Record<string, unknown>),
              prUrl: pr.url,
              prNumber: pr.number,
              prBranch: input.head_branch as string,
            },
          },
        });

        // Create a TicketEvent for the timeline
        await this.prisma.ticketEvent.create({
          data: {
            ticketId: context.ticket.id,
            tenantId: context.tenantId,
            eventType: 'fix_proposed',
            data: {
              prUrl: pr.url,
              prNumber: pr.number,
              branch: input.head_branch as string,
              title: input.title as string,
            },
          },
        });

        return pr;
      }
```

### Tâche 3 : Émettre un événement WebSocket `ticket:fix_proposed`

**Fichier :** `apps/api/src/modules/agent-v2/deep-analysis.service.ts`

Dans la méthode `analyze()`, après `await this.agenticLoop.run(loopOptions)`, ajouter la détection
de PR créée et l'émission de l'événement :

```typescript
// Après : const result = await this.agenticLoop.run(loopOptions);
// Ajouter :

// Check if a PR was created during the agentic loop
const prToolCall = result.toolCallLog.find((t) => t.name === 'create_pull_request' && !t.error);
if (prToolCall) {
  const prResult = prToolCall.result as { url: string; number: number } | undefined;
  this.eventEmitter.emit('ticket:fix_proposed', {
    ticketId,
    tenantId,
    prUrl: prResult?.url,
    prNumber: prResult?.number,
  });
}
```

> **Note :** `EventEmitter2` est déjà injecté dans `AgenticLoopService`. Pour l'utiliser dans
> `DeepAnalysisService`, l'importer depuis `@nestjs/event-emitter` et l'injecter dans le constructeur.

### Tâche 4 : Exposer l'événement sur le WebSocket gateway

**Fichier :** `apps/api/src/modules/agent-v2/agent-v2.gateway.ts`

Ajouter un listener `@OnEvent('ticket:fix_proposed')` qui broadcast au room du ticket :

```typescript
@OnEvent('ticket:fix_proposed')
handleFixProposed(payload: {
  ticketId: string;
  tenantId: string;
  prUrl: string;
  prNumber: number;
}) {
  this.server.to(`ticket:${payload.ticketId}`).emit('ticket:fix_proposed', {
    ticketId: payload.ticketId,
    prUrl: payload.prUrl,
    prNumber: payload.prNumber,
  });
}
```

### Validation de l'US-02

- [ ] Après qu'une PR est créée, `ticket.status === 'fix_proposed'`
- [ ] Un `TicketEvent` avec `eventType: 'fix_proposed'` existe en DB
- [ ] Le dashboard reçoit l'événement WebSocket `ticket:fix_proposed` en temps réel
- [ ] La timeline du ticket affiche "Fix proposé — PR #X"

---

## US-03 — Lien PR dans la timeline du ticket (Dashboard)

**Priorité :** Moyenne — améliore la visibilité pour les équipes
**Fichiers à modifier :**
- `apps/dashboard/app/(dashboard)/tickets/[id]/` (composant timeline)
- `apps/web/src/` (si ticket detail page existe)

### Tâche : Afficher l'événement `fix_proposed` dans la timeline

Dans le composant qui affiche la timeline d'un ticket, ajouter le rendu de l'événement
`fix_proposed` :

```tsx
// Dans le switch/map qui rend les TicketEvent :
case 'fix_proposed': {
  const data = event.data as { prUrl: string; prNumber: number; branch: string; title: string };
  return (
    <TimelineItem key={event.id} icon={<GitPullRequest className="h-4 w-4 text-green-500" />}>
      <span className="font-medium">Fix proposé</span>
      {' — '}
      <a
        href={data.prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
      >
        PR #{data.prNumber}: {data.title}
      </a>
      <span className="ml-2 text-xs text-muted-foreground">branche: {data.branch}</span>
    </TimelineItem>
  );
}
```

> Adapter `TimelineItem` au composant existant dans le projet. L'icône `GitPullRequest` est disponible
> dans `lucide-react` (déjà installé).

---

## Ordre d'exécution et dépendances

```
US-01  ─────────────────────────────────────────────►  Outils write GitHub
   │                                                    (bloquant tout le reste)
   ▼
US-02  ─────────────────────────────────────────────►  Statut + WebSocket
   │
   ▼
US-03  ─────────────────────────────────────────────►  UI Timeline PR
```

Chaque US est indépendante dans son scope de fichiers — pas de conflits possibles si exécutées
séquentiellement.

---

## Règles anti-régression

> À respecter lors de l'implémentation.

1. **Read before write** — Ne jamais appeler `write_file` sans avoir d'abord appelé `read_file` sur
   le fichier cible pour obtenir son contenu exact.
2. **Schema.prisma est la source de vérité** — Vérifier le type du champ `status` sur `Ticket`
   avant de lui assigner `fix_proposed`.
3. **Jamais de write direct sur la branche par défaut** — Toujours `create_branch` en premier.
4. **Fichier complet dans `write_file`** — Pas de diffs, pas de contenu partiel.
5. **Vérifier les envs** — S'assurer que `GITHUB_APP_ID` et `GITHUB_PRIVATE_KEY` sont définis avant
   de tenter une opération write (lever une exception explicite sinon).
6. **Build obligatoire après chaque US** — `pnpm --filter @support-helper/api build` doit passer à 0
   erreur avant de committer.

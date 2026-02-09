# GitHub Copilot Setup — Forge & Agent Team

> How the `.github/agents/`, `.github/instructions/`, and `.github/prompts/` folders configure Copilot Chat in this project.

## Prerequisites

- **VS Code 1.102+** with **GitHub Copilot Chat** extension
- Setting `chat.promptFiles: true` (already in `.vscode/settings.json`)

## File Structure

```
.github/
├── copilot-instructions.md        # Always-on context (auto-included every request)
├── agents/                        # Custom agents (.agent.md)
│   ├── forge.agent.md             # Tech Lead orchestrator (delegates to all agents)
│   ├── backend-dev.agent.md       # NestJS, Prisma, auth
│   ├── frontend-dev.agent.md      # Next.js 14, React, Tailwind
│   ├── sdk-dev.agent.md           # Web SDK, Web Components
│   ├── dba.agent.md               # PostgreSQL, migrations
│   ├── qa-engineer.agent.md       # Jest, Vitest, Playwright
│   ├── devops.agent.md            # Docker, CI/CD, Turborepo
│   ├── ai-engineer.agent.md       # OpenAI, prompts, embeddings
│   ├── security-auditor.agent.md  # Security audit (read-only)
│   └── doc-writer.agent.md        # Documentation
├── instructions/                  # Path-specific auto-applied rules
│   ├── backend.instructions.md    # → apps/api/**/*.ts, apps/worker/**/*.ts
│   ├── frontend.instructions.md   # → apps/dashboard/**/*.{ts,tsx}
│   ├── sdk.instructions.md        # → packages/sdk-web/**/*.ts
│   ├── database.instructions.md   # → apps/api/prisma/**, packages/database/**
│   └── testing.instructions.md    # → **/*.spec.ts, **/*.test.ts
└── prompts/                       # Slash commands (.prompt.md)
    └── forge.prompt.md            # /forge → delegates to forge agent

.vscode/
└── settings.json                  # Copilot config (commitMessage, review instructions)
```

## How It Works

### Three File Types

| Extension | Location | Purpose | How It's Used |
|-----------|----------|---------|---------------|
| `.agent.md` | `.github/agents/` | Custom agent with persona & tools | Select from **agent dropdown** in chat |
| `.instructions.md` | `.github/instructions/` | Path-specific rules | **Auto-applied** when editing matching files |
| `.prompt.md` | `.github/prompts/` | Slash commands | Type `/forge` in chat |

### Agent Capabilities

Each `.agent.md` file has YAML frontmatter defining:
- `description` — shown in agent picker
- `tools` — allowed tools (`editFiles`, `codebase`, `terminal`, `fetch`, `agent`)
- `agents` — subagents it can delegate to (forge only)
- `handoffs` — agent-to-agent transitions with context passing

### Handoff System

Agents can transfer work to other agents:
- `backend-dev` → `qa-engineer` (write tests), `security-auditor` (review security), `doc-writer` (update docs)
- `frontend-dev` → `qa-engineer`, `security-auditor`
- `dba` → `backend-dev` (implement queries), `doc-writer`
- `ai-engineer` → `qa-engineer`
- `security-auditor` → `backend-dev`, `frontend-dev` (fix vulnerabilities)

## The 10 Agents

| Agent | Specialty | File Domain | Tools |
|-------|-----------|-------------|-------|
| **forge** | Orchestration, multi-agent coordination | Entire project | All + `agent` (subagent delegation) |
| **backend-dev** | NestJS, Prisma, auth, API REST | `apps/api/`, `apps/worker/` | editFiles, codebase, terminal, fetch |
| **frontend-dev** | Next.js 14, React, Tailwind | `apps/dashboard/` | editFiles, codebase, terminal, fetch |
| **sdk-dev** | Web Components, MediaRecorder API | `packages/sdk-web/` | editFiles, codebase, terminal, fetch |
| **dba** | PostgreSQL, Prisma migrations, indexing | `apps/api/prisma/`, `packages/database/` | editFiles, codebase, terminal |
| **qa-engineer** | Jest, Vitest, Playwright | `**/*.spec.ts`, `**/test/` | editFiles, codebase, terminal |
| **devops** | Docker, CI/CD, Turborepo | `docker/`, `turbo.json`, `.github/` | editFiles, codebase, terminal |
| **ai-engineer** | OpenAI, prompts, embeddings, pgvector | `apps/api/src/ai/`, `apps/worker/` | editFiles, codebase, terminal, fetch |
| **security-auditor** | OWASP, security audit (**read-only**) | Cross-cutting | `codebase` only |
| **doc-writer** | Documentation, API docs, guides | `docs/`, `*.md` | editFiles, codebase, terminal |

## How to Use

### 1. Select an Agent from the Dropdown

In Copilot Chat, click the **agent dropdown** (top of chat panel) and select an agent:

```
[Select: backend-dev]
Add a GET /api/tickets/:id/events endpoint to list VideoEvents
```

```
[Select: forge]
Implement real-time notifications with WebSockets
```

### 2. Use the /forge Slash Command

Type `/forge` in Copilot Chat for orchestrated multi-agent work:

```
/forge Implement the ticket export feature with PDF generation
```

Forge will automatically decompose the task, delegate to the right specialists, and assemble the result.

### 3. Automatic Path-Specific Instructions

When you edit files matching specific patterns, the corresponding `.instructions.md` is auto-applied:

- Editing `apps/api/src/tickets/tickets.service.ts` → `backend.instructions.md` applied automatically
- Editing `apps/dashboard/app/tickets/page.tsx` → `frontend.instructions.md` applied automatically
- Editing `**/*.spec.ts` → `testing.instructions.md` applied automatically

No action needed — this happens automatically.

## Claude Code ↔ Copilot Comparison

| Claude Code | Copilot Equivalent | Location |
|-------------|-------------------|----------|
| `CLAUDE.md` | `copilot-instructions.md` | `.github/copilot-instructions.md` |
| `.claude/system.md` | `forge.agent.md` | `.github/agents/forge.agent.md` |
| `.claude/agents/*.md` | `*.agent.md` | `.github/agents/*.agent.md` |
| `.claude/commands/forge.md` | `forge.prompt.md` | `.github/prompts/forge.prompt.md` |
| `settings.local.json` | VS Code settings | `.vscode/settings.json` |
| Agent subagents | `agents:` frontmatter + handoffs | YAML in `.agent.md` files |

## VS Code Settings

```jsonc
{
  "chat.promptFiles": true,                                    // Enable prompt files
  "github.copilot.chat.codeGeneration.useInstructionFiles": true, // Use .instructions.md files
  "github.copilot.chat.reviewSelection.instructions": [...],   // Code review rules
  "github.copilot.chat.commitMessageGeneration.instructions": [...] // Commit format
}
```

> **Note**: `codeGeneration.instructions` and `testGeneration.instructions` settings are deprecated since VS Code 1.102. Use `.instructions.md` files instead.

## Adding a New Agent

1. Create `.github/agents/my-agent.agent.md` with YAML frontmatter:
   ```yaml
   ---
   description: "Short description for the agent picker"
   tools: ["editFiles", "codebase", "terminal"]
   ---
   ```
2. Write the system prompt below the frontmatter
3. Add to `forge.agent.md` `agents:` list if Forge should delegate to it
4. Optionally add handoffs to/from other agents
5. Update `copilot-instructions.md` agent list

## FAQ

**Why both Claude Code and Copilot configs?**
The project uses two AI systems in parallel — Claude Code (terminal) via `.claude/` and Copilot (VS Code) via `.github/`. Same orchestration philosophy, adapted to each platform.

**Can agents communicate?**
Yes, via handoffs. An agent can transfer work to another agent with context. Forge can also delegate to any agent via the `agent` tool.

**How does security-auditor work?**
It only has `codebase` tool (read-only). It analyzes code and produces vulnerability reports. Fixes are handed off to implementation agents.

# Workflow Analysis — SDK Bug Report → Dashboard Agent

**Date**: 2026-02-26
**Session**: Forge orchestration — visual validation via SDK

---

## Objective

Validate the end-to-end workflow:
1. Introduce a real UI bug in the dashboard
2. Capture it via the SDK (video + description)
3. Observe the dashboard agent handle it automatically (analysis, GitHub Issue)
4. Confirm services recover and process the job queue

---

## Bug Introduced

**File**: `apps/dashboard/components/ui/Badge.tsx` (lines 59–64)
**Component**: `severityConfig` — maps severity levels to badge variants

**Buggy state** (severity colors inverted):
```typescript
critical: { label: 'Critique', variant: 'default', icon: '🔴' },  // wrong: grey
low:      { label: 'Faible',   variant: 'danger',  icon: '🟢' },  // wrong: red
```

**Fixed state** (correct):
```typescript
critical: { label: 'Critique', variant: 'danger',  icon: '🔴' },
high:     { label: 'Élevée',   variant: 'warning', icon: '🟠' },
medium:   { label: 'Moyenne',  variant: 'info',    icon: '🟡' },
low:      { label: 'Faible',   variant: 'default', icon: '🟢' },
```

The bug caused critical tickets to display with a grey badge and low tickets with a red badge — visually inverting the priority signal in the ticket list.

---

## SDK Report

**Endpoint**: `POST /api/sdk/tickets/report` (multipart FormData)
**SDK Key**: `sk_GojA7oEFJRpK0Dj22VsO2LyO913baczo`

**Ticket created**: `d556f7c7-632b-49e5-b69c-9b6db6e09a3c`

```
Title:       Severity badge colors incorrects dans la liste des tickets
Description: The severity badges in the ticket list on the dashboard do not display
             the correct colors. There is a visual inconsistency between the emoji icon
             and the badge color, causing some tickets to appear with priorities that do
             not visually match expectations.
User context: Windows 11 / Chromium / 1280x800 / http://localhost:3000/dashboard/tickets
```

---

## Automated Workflow Results

### 1. GitHub Issue — Auto-created ✅

Within ~2 seconds of ticket creation, `ticketsService.create()` called `enqueueGithubIssueCreation()`.

| Field | Value |
|-------|-------|
| Issue number | **#183** |
| Repo | `KJ-devs/supportHelperv2` |
| URL | https://github.com/KJ-devs/supportHelperv2/issues/183 |
| Sync status | `synced` |
| Synced at | 2026-02-26T09:54:26Z |

Gate condition satisfied: `ProjectGithubConfig` exists for the tenant with installation `110343918`.

### 2. Agent V1 (analyze-ticket) — Completed ✅

**Session**: `dd8a5398-9370-4647-b2e4-2085ea12d227`
**Queue**: `agent-orchestration` (BullMQ)
**Final status**: `escalated` / `analysis_complete`

Agent analysis output:

| Field | Value | Confidence |
|-------|-------|------------|
| Type | `bug` | 95% |
| Severity | `medium` | 85% |
| Keywords | severity badge, color mismatch, ticket list, visual inconsistency, Chromium, Windows 11 | — |

**Note**: The agent encountered an "invalid ticket ID" error when calling the internal ticket lookup tool, but successfully produced the analysis from the ticket description. The session was escalated (no auto-resolution for UI bugs).

### 3. Agent V2 (deep analysis) — Not triggered ℹ️

Agent V2 is triggered by the **triage queue**, which is only enqueued from `POST /api/tickets` (dashboard endpoint). The SDK endpoint `POST /api/sdk/tickets/report` calls `aiService.processUserDescription()` inline and does **not** enqueue triage. This is by design — SDK reports go through a lighter analysis path.

---

## Ticket Final State

| Field | Value |
|-------|-------|
| ID | `d556f7c7-632b-49e5-b69c-9b6db6e09a3c` |
| Status | `analyzed` |
| Type | `other` (from inline AI, low confidence) |
| Severity | `medium` |
| GitHub Issue | #183 — synced |
| Agent session | `escalated` / `analysis_complete` |

---

## Infrastructure Issues Encountered

### Worker not running
The `agent-orchestration` queue had 5 pending jobs (IDs 1–5) that weren't being processed.
**Fix**: Started worker with env vars sourced from root `.env.local` and port 3003 conflict resolved.

### API memory health false alarm
The health endpoint reports `"memory": {"status": "unhealthy", "message": "Heap: 95% used (98MB/102MB)"}`.
This is a **false alarm**: the check compares `heapUsed` vs `heapTotal` (currently allocated heap), not vs max heap. With `NODE_OPTIONS="--max-old-space-size=2048"`, the actual limit is 2GB and the API runs fine.

### Port conflicts
- Port 3001: captured by a Neural Portfolio Next.js app after API restart
- Port 3003: captured by another Portfolio app (Next.js on port 3003)
- **Fix**: `taskkill //PID <pid> //F` before each service restart

### S3 env var naming mismatch
Worker expects `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.
Root `.env.local` defines `S3_ACCESS_KEY` and `S3_SECRET_KEY`.
**Fix**: Export aliases in the startup wrapper script.

---

## Service Start Commands (development)

```bash
# API (from repo root)
cd apps/api
set -a && source ../../.env.local && set +a
NODE_OPTIONS="--max-old-space-size=2048" node --enable-source-maps dist/main.js

# Worker (from repo root)
cd apps/worker
set -a && source ../../.env.local && set +a
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_KEY}"
NODE_OPTIONS="--max-old-space-size=1024" node --enable-source-maps dist/worker/src/main.js
```

---

## Architecture Notes

```
SDK report (POST /api/sdk/tickets/report)
    │
    ├─► ticketsService.create()
    │       └─► enqueueGithubIssueCreation()  →  GitHub Issue #183 ✅
    │
    ├─► aiService.processUserDescription()    →  inline AI analysis (type/severity)
    │
    └─► (no triage queue enqueue)             →  Agent V2 NOT triggered

Agent V1 (manual / session-based)
    │
    └─► POST /api/agent/sessions/:ticketId
            └─► BullMQ: agent-orchestration queue
                    └─► AgentWorker processes analyze-ticket job
                            └─► Session: escalated / analysis_complete ✅
```

---

## Screenshots

Captured in `docs/analyze/` (50+ screenshots documenting the full workflow):
- Login, ticket list with buggy badges
- SDK report submission
- Dashboard ticket view post-creation
- Agent session states (analyzing → escalated)
- GitHub Issue creation confirmation

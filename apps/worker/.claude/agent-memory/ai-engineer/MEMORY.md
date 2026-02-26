# AI Engineer Agent Memory

## Key Architecture

- Worker agent service: `apps/worker/src/services/agent.service.ts`
- Worker agent processor: `apps/worker/src/workers/agent.worker.ts`
- API agent service: `apps/api/src/modules/agent/agent.service.ts`
- AI service (API): `apps/api/src/ai/ai.service.ts`

## Agent Pipeline (analyze-ticket)

1. `AgentService.startSession()` in API creates AgentSession + enqueues `analyze-ticket` to `agent-orchestration` queue
2. `AgentWorker.handleAnalyzeTicket()` in worker picks up the job
3. Calls `AgentService.runWithFunctionCalling()` with a prompt + GPT-4o tools
4. GPT can call: `search_similar_tickets`, `get_ticket_details`, `update_ticket_status`, `escalate_to_human`, `suggest_solution`

## Critical Pattern: Always include ticket ID in prompts

When the system prompt encourages GPT to call `get_ticket_details`, **the ticket ID must be explicitly present in the user prompt**. If it is absent, GPT will hallucinate an ID, the tool returns not-found, and GPT reports "invalid ticket ID".

Fix applied in `buildAnalysisPrompt()` (`agent.worker.ts`): added `Ticket ID: ${ticket.id}` as the first field.

## Tool Security: tenantId scoping

`toolGetTicketDetails` must filter by `tenantId` to prevent cross-tenant data leakage. Use `findFirst({ where: { id, tenantId } })` not `findUnique({ where: { id } })`. Return a structured `{ error: string }` object (not `null`) when not found — returning `null` is serialized as the string `"null"` and confuses GPT.

See: `apps/worker/src/services/agent.service.ts` → `toolGetTicketDetails(ticketId, tenantId)`

## Build commands

- Worker: `pnpm --filter @support-helper/worker build`
- API: `pnpm --filter @support-helper/api build`

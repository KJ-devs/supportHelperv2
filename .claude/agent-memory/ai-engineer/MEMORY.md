# AI Engineer Agent Memory

## AI Pipeline Architecture

- Video upload → S3/MinIO → Worker picks up job
- FFmpeg keyframe extraction → Tesseract OCR → GPT-4 Vision analysis
- Results stored in Ticket: `aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`
- Media processing status: `pending` → `processing` → `completed` → `failed`
- Agent state machine: `ANALYZING` → `NEEDS_INFO` / `PROPOSING` → `WAITING` → `RESOLVED` / `ESCALATED`

## Key Files

- AI service: `apps/api/src/ai/`
- Video analysis worker: `apps/worker/src/workers/video-analysis.worker.ts`
- Agent worker: `apps/worker/src/workers/agent.worker.ts`
- Agent service: `apps/worker/src/services/agent.service.ts`
- OpenAI service (embeddings + Anthropic vision): `apps/worker/src/services/openai.service.ts`

## Function Calling Architecture

- Tool definitions live in `agent.service.ts` as `AGENT_FUNCTION_TOOLS` (OpenAI SDK types)
- Multi-turn loop: `AgentService.runWithFunctionCalling()` — up to 5 iterations
- Loop: call OpenAI → check `tool_calls` → execute → append `tool` messages → repeat
- Tool implementations: `toolSearchSimilarTickets`, `toolGetTicketDetails`, `toolUpdateTicketStatus`, `toolEscalateToHuman`, `toolSuggestSolution` in `AgentService`
- Worker delegates to `agentService.runWithFunctionCalling()` for both `analyze-ticket` and `auto-respond` jobs
- Exports: `ToolCallResult`, `FunctionCallingLoopResult` from `agent.service.ts`

## AI Provider Strategy

- `OpenAIService` (openai.service.ts): Anthropic for vision/completion, OpenAI (optional) for embeddings
- `AgentService` (agent.service.ts): Anthropic preferred, OpenAI fallback; OpenAI used for function calling loop
- Function calling only works with OpenAI client — Anthropic path falls back to plain chatCompletion
- `chatCompletion()` in AgentService uses whichever provider is configured (Anthropic preferred)

## Common Pitfalls

- `openaiService.chat({tools:...})` using Anthropic backend returns `tool_calls: undefined` — tools are ignored
- Actual function calling requires the `openaiClient` (OpenAI SDK) with `tool_choice: 'auto'`
- Prisma `agentState` JSON field requires `JSON.parse(JSON.stringify(...))` to avoid TS type errors with complex objects
- `VideoEvent.timestamp` does not exist — use `timestampMs` (the actual field name in the schema)

## Notes

- OpenAI API key required via `OPENAI_API_KEY` env var (optional — used for embeddings + function calling)
- Anthropic API key via `ANTHROPIC_API_KEY` (primary for completions/vision)
- pgvector extension enabled for embeddings (`text-embedding-3-large` via OpenAI)
- Worker uses BullMQ for job queuing via Redis

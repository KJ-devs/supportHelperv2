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

- `OpenAIService` (openai.service.ts): dual-provider for vision/classification; OpenAI always for embeddings
- `analyzeVideo()` and `classifyTicket()` branch on `resolveTenantConfig()`: provider='openai' → OpenAI path, otherwise Anthropic
- OpenAI video: `gpt-4o` with `image_url` base64 blocks (`detail: 'low'`); Anthropic: base64 `source` blocks
- OpenAI classification: `gpt-4o-mini` (cheaper); Anthropic: `claude-haiku-4-5-20251001`
- Env-var fallback: if no tenant config AND no `ANTHROPIC_API_KEY` AND `openaiClient` exists → use OpenAI
- `AgentService` (agent.service.ts): Anthropic preferred, OpenAI fallback; OpenAI used for function calling loop
- Function calling only works with OpenAI client — Anthropic path falls back to plain chatCompletion
- `chatCompletion()` in AgentService uses whichever provider is configured (Anthropic preferred)
- MODEL_COSTS map includes `gpt-4o` and `gpt-4o-mini` entries for cost tracking

## Common Pitfalls

- `openaiService.chat({tools:...})` using Anthropic backend returns `tool_calls: undefined` — tools are ignored
- Actual function calling requires the `openaiClient` (OpenAI SDK) with `tool_choice: 'auto'`
- Prisma `agentState` JSON field requires `JSON.parse(JSON.stringify(...))` to avoid TS type errors with complex objects
- `VideoEvent.timestamp` does not exist — use `timestampMs` (the actual field name in the schema)

## Per-Tenant AI Config (BYOK)

- `AiConfig` table (schema: `ai_configs`) stores per-tenant API keys, model, provider
- `encryptedApiKey` is stored AES-256-GCM encrypted: `iv:authTag:ciphertext` (all base64, colon-separated)
- Encryption key: `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)
- Worker `PrismaService` has NO encryption middleware — must decrypt manually (unlike API)
- `OpenAIService.resolveTenantConfig(tenantId)` queries DB, decrypts key, returns `TenantAiConfig`
- In-memory cache: `Map<tenantId, TenantAiConfig>` with 5-minute TTL (`resolvedAt` timestamp)
- `getAnthropicClientForTenant(tenantId)` returns per-tenant `Anthropic` client or falls back to shared
- Fallback chain: tenant DB config → `ANTHROPIC_API_KEY` env var
- `chat()` method accepts optional `tenantId` param to use per-tenant config
- `isEncryptedPayload()` helper detects the `iv:authTag:ciphertext` format to avoid double-decryption on plain-text dev keys

## Notes

- OpenAI API key required via `OPENAI_API_KEY` env var (optional — used for embeddings + function calling)
- Anthropic API key via `ANTHROPIC_API_KEY` (primary for completions/vision)
- pgvector extension enabled for embeddings (`text-embedding-3-large` via OpenAI)
- Worker uses BullMQ for job queuing via Redis

# AI Engineer Agent Memory

## AI Pipeline Architecture

- Video upload → S3/MinIO → Worker picks up job
- FFmpeg keyframe extraction → Tesseract OCR → GPT-4 Vision analysis
- Results stored in Ticket: `aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`
- Media processing status: `pending` → `processing` → `completed` → `failed`

## Key Files

- AI service: `apps/api/src/ai/`
- Video analysis worker: `apps/worker/src/workers/video-analysis.worker.ts`
- Agent worker: `apps/worker/src/workers/agent.worker.ts`
- Agent service: `apps/worker/src/services/agent.service.ts`

## Notes

- OpenAI API key required via `OPENAI_API_KEY` env var
- pgvector extension enabled for embeddings
- Worker uses BullMQ for job queuing via Redis

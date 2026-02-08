# Support Helper Worker Service

NestJS-based AI worker service for background job processing.

## Overview

This service handles all background processing for the Support Helper platform:

- **Video Analysis** - Full video processing pipeline
- **GitHub Sync** - Bidirectional issue synchronization  
- **Agent Orchestration** - AI-powered ticket handling

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Worker Service                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ VideoAnalysis    │  │ GithubSync       │  │ Agent         │ │
│  │ Worker           │  │ Worker           │  │ Worker        │ │
│  │                  │  │                  │  │               │ │
│  │ • FFmpeg extract │  │ • Sync issues    │  │ • Analyze     │ │
│  │ • OCR parallel   │  │ • Create issues  │  │ • Classify    │ │
│  │ • YOLO detection │  │ • Webhooks       │  │ • Suggest     │ │
│  │ • GPT-4 Vision   │  │ • Update issues  │  │ • Respond     │ │
│  │ • Embeddings     │  │                  │  │ • Escalate    │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│                    ┌────────────▼────────────┐                  │
│                    │      BullMQ Queues      │                  │
│                    │  (Redis-backed)         │                  │
│                    │                         │                  │
│                    │  • video-analysis       │                  │
│                    │  • github-sync          │                  │
│                    │  • agent-orchestration  │                  │
│                    └────────────┬────────────┘                  │
│                                 │                               │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │     External Services      │
                    │                           │
                    │  • PostgreSQL (Prisma)    │
                    │  • Redis (BullMQ)         │
                    │  • S3/MinIO (Videos)      │
                    │  • Meilisearch (Search)   │
                    │  • OpenAI API             │
                    │  • GitHub API             │
                    └───────────────────────────┘
```

## Workers

### VideoAnalysisWorker

Processes uploaded videos through the AI pipeline:

1. **Download** - Fetch video from S3
2. **Extract** - FFmpeg keyframe extraction (1 frame/sec)
3. **OCR** - Tesseract parallel processing (4 workers)
4. **Detection** - YOLO v11 UI element detection
5. **Vision** - GPT-4o analysis (batch 10 frames)
6. **Embeddings** - text-embedding-3-large generation
7. **Update** - Store results in database
8. **Index** - Update Meilisearch

### GithubSyncWorker

Handles GitHub integration:

- Bidirectional issue sync
- Webhook event processing
- Issue creation from tickets
- Issue updates and status sync
- Repository full sync

### AgentWorker

AI agent orchestration:

- Ticket analysis and classification
- Solution suggestions based on similar tickets
- Automatic responses with GPT-4o
- Intelligent escalation to humans
- Function calling for tool use

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/support_helper

# Redis (shared with API)
REDIS_URL=redis://localhost:6379

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=support-helper

# Meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=masterKey

# OpenAI
OPENAI_API_KEY=sk-...

# GitHub App
GITHUB_APP_ID=12345
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."

# Worker Config
WORKER_PORT=3001
WORKER_CONCURRENCY=10
```

### Queue Configuration

| Queue | Priority | Concurrency | Retry |
|-------|----------|-------------|-------|
| video-analysis | 5 | 10 | 3 attempts |
| github-sync | 3 | 10 | 3 attempts |
| agent-orchestration | 10 | 10 | 5 attempts |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Redis 7+
- PostgreSQL 15+
- FFmpeg installed

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @support-helper/api db:generate

# Start development
pnpm --filter @support-helper/worker start:dev
```

### Running

```bash
# Development
pnpm --filter @support-helper/worker start:dev

# Production
pnpm --filter @support-helper/worker build
pnpm --filter @support-helper/worker start:prod
```

## API Endpoints

### Health Check

```bash
# Full health status
GET /health

# Liveness probe
GET /health/live

# Readiness probe
GET /health/ready
```

### Response Example

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "services": {
    "database": true,
    "redis": true,
    "meilisearch": true
  },
  "queues": {
    "video-analysis": {
      "waiting": 5,
      "active": 2,
      "completed": 150,
      "failed": 3
    },
    "github-sync": {
      "waiting": 0,
      "active": 1,
      "completed": 45,
      "failed": 0
    },
    "agent-orchestration": {
      "waiting": 12,
      "active": 5,
      "completed": 230,
      "failed": 8
    }
  }
}
```

## Project Structure

```
src/
├── main.ts                 # Entry point
├── app.module.ts           # Main module
├── config/                 # Configuration
│   ├── ffmpeg.config.ts
│   ├── ocr.config.ts
│   ├── openai.config.ts
│   ├── queue.config.ts
│   └── yolo.config.ts
├── queues/                 # BullMQ setup
│   ├── queues.module.ts
│   └── queue.types.ts
├── workers/                # Worker processors
│   ├── video-analysis.worker.ts
│   ├── github-sync.worker.ts
│   └── agent.worker.ts
├── services/               # Shared services
│   ├── ffmpeg.service.ts
│   ├── ocr.service.ts
│   ├── openai.service.ts
│   ├── yolo.service.ts
│   ├── s3.service.ts
│   ├── github.service.ts
│   ├── meilisearch.service.ts
│   └── prisma.service.ts
├── health/                 # Health checks
│   └── health.controller.ts
└── utils/                  # Utilities
    ├── retry.utils.ts
    ├── array.utils.ts
    └── file.utils.ts
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/bullmq | ^10.2.0 | Queue management |
| bullmq | ^5.26.0 | BullMQ library |
| openai | ^4.26.0 | OpenAI API |
| fluent-ffmpeg | ^2.1.3 | Video processing |
| tesseract.js | ^5.1.0 | OCR |
| sharp | ^0.33.0 | Image processing |
| meilisearch | ^0.41.0 | Search |
| @octokit/rest | ^21.0.0 | GitHub API |

## Testing

```bash
# Unit tests
pnpm --filter @support-helper/worker test

# Watch mode
pnpm --filter @support-helper/worker test:watch

# Coverage
pnpm --filter @support-helper/worker test:cov
```

## Docker

```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/main.js"]
```

## License

MIT

# Support Helper Platform - Architecture Complète

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture globale](#architecture-globale)
3. [Stack technique](#stack-technique)
4. [Modèle de données](#modèle-de-données)
5. [Flux de données](#flux-de-données)
6. [Découpage MVP / V1 / V2](#découpage-mvp--v1--v2)
7. [Risques et mitigations](#risques-et-mitigations)
8. [Modèle SaaS](#modèle-saas)

---

## Vue d'ensemble

### Objectif

Créer une plateforme de support technique complète permettant aux utilisateurs de reporter des problèmes en 1 clic, avec automatisation maximale via l'IA.

### Composants principaux

| Composant | Description |
|-----------|-------------|
| **SDK Client** | Installable sur Windows/macOS/Linux ou intégrable dans toute application |
| **AI Pipeline** | Analyse vidéo, OCR, classification automatique avant stockage |
| **Dashboard** | Interface web moderne pour la gestion des tickets |
| **GitHub Integration** | Corrélation tickets ↔ issues ↔ commits |
| **Agent IA** | Support autonome avec escalade intelligente |

### Contraintes

- Scalabilité horizontale
- RGPD compliant
- Multi-tenant
- API-first
- Extensible (Notion, HubSpot, Jira)

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SUPPORT HELPER PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           CLIENT LAYER                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  Web SDK    │  │ Desktop SDK │  │ Mobile SDK  │  │  Browser Extension  │  │   │
│  │  │  (npm pkg)  │  │  (Electron/ │  │  (React     │  │  (Chrome/Firefox)   │  │   │
│  │  │             │  │   Tauri)    │  │   Native)   │  │                     │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  │         │                │                │                     │             │   │
│  │         └────────────────┴────────────────┴─────────────────────┘             │   │
│  │                                    │                                           │   │
│  │                          ┌─────────▼─────────┐                                │   │
│  │                          │   SDK Core Layer  │                                │   │
│  │                          │  - Video Capture  │                                │   │
│  │                          │  - Log Collector  │                                │   │
│  │                          │  - Context Builder│                                │   │
│  │                          │  - Offline Queue  │                                │   │
│  │                          │  - Encryption     │                                │   │
│  │                          └─────────┬─────────┘                                │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                               │
│                                       │ HTTPS/WSS (TLS 1.3)                          │
│                                       │ JWT + API Key Auth                           │
│                                       ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           API GATEWAY (Kong/AWS API GW)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │Rate Limiting│  │ Auth/AuthZ  │  │ Request     │  │  Multi-tenant       │  │   │
│  │  │  & Quotas   │  │   (OAuth2)  │  │ Validation  │  │  Routing            │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           INGESTION LAYER                                      │   │
│  │                                                                                │   │
│  │  ┌─────────────────────┐          ┌─────────────────────┐                    │   │
│  │  │   Upload Service    │          │   Event Collector   │                    │   │
│  │  │  - Chunked Upload   │          │  - Real-time logs   │                    │   │
│  │  │  - S3 Direct Upload │          │  - WebSocket sink   │                    │   │
│  │  │  - Resume Support   │          │  - Batch processor  │                    │   │
│  │  └──────────┬──────────┘          └──────────┬──────────┘                    │   │
│  │             │                                │                                │   │
│  │             └────────────────┬───────────────┘                                │   │
│  │                              ▼                                                │   │
│  │                    ┌─────────────────────┐                                    │   │
│  │                    │   Message Queue     │                                    │   │
│  │                    │  (Apache Kafka /    │                                    │   │
│  │                    │   AWS SQS+SNS)      │                                    │   │
│  │                    └──────────┬──────────┘                                    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                  │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           AI PROCESSING LAYER                                  │   │
│  │                                                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                      Video Analysis Pipeline                            │ │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │   │
│  │  │  │  Frame   │  │   OCR    │  │  Action  │  │  Error   │  │ Summary  │ │ │   │
│  │  │  │Extraction│─▶│ Service  │─▶│Detection │─▶│Detection │─▶│Generator │ │ │   │
│  │  │  │ (FFmpeg) │  │(Tesseract│  │ (OpenAI  │  │  (YOLO/  │  │ (GPT-4)  │ │ │   │
│  │  │  │          │  │  /EasyOCR│  │  Vision) │  │  Custom) │  │          │ │ │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Classification Pipeline                              │ │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │   │
│  │  │  │    NLP       │  │  Severity    │  │  Category    │                  │ │   │
│  │  │  │ Classifier   │──│  Estimator   │──│   Router     │                  │ │   │
│  │  │  │(Fine-tuned   │  │(Rule+ML      │  │(Rule-based   │                  │ │   │
│  │  │  │ BERT/GPT)    │  │ Hybrid)      │  │ + ML)        │                  │ │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                  │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                  │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           CORE SERVICES LAYER                                  │   │
│  │                                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Ticket    │  │    User     │  │   GitHub    │  │   Notification      │  │   │
│  │  │  Service    │  │  Service    │  │Integration  │  │     Service         │  │   │
│  │  │             │  │             │  │  Service    │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │                                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  Tenant     │  │   Search    │  │  Analytics  │  │    Agent            │  │   │
│  │  │  Service    │  │  Service    │  │   Service   │  │   Orchestrator      │  │   │
│  │  │             │  │(Elasticsearch)│ │             │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                  │                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           DATA LAYER                                           │   │
│  │                                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ PostgreSQL  │  │   Redis     │  │    S3 /     │  │   Elasticsearch     │  │   │
│  │  │ (Primary DB)│  │  (Cache +   │  │   MinIO     │  │   (Search Index)    │  │   │
│  │  │             │  │   Session)  │  │  (Videos)   │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │                                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐                                            │   │
│  │  │   Vector    │  │  ClickHouse │                                            │   │
│  │  │   Store     │  │ (Analytics) │                                            │   │
│  │  │ (pgvector)  │  │             │                                            │   │
│  │  └─────────────┘  └─────────────┘                                            │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           AI AGENT LAYER                                       │   │
│  │                                                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Autonomous Support Agent                             │ │   │
│  │  │                                                                         │ │   │
│  │  │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │ │   │
│  │  │  │   Ticket     │     │   Solution   │     │   Escalation │            │ │   │
│  │  │  │   Analyzer   │────▶│   Proposer   │────▶│   Manager    │            │ │   │
│  │  │  │              │     │              │     │              │            │ │   │
│  │  │  └──────────────┘     └──────────────┘     └──────────────┘            │ │   │
│  │  │         │                    │                    │                     │ │   │
│  │  │         └────────────────────┼────────────────────┘                     │ │   │
│  │  │                              ▼                                          │ │   │
│  │  │                    ┌──────────────────┐                                 │ │   │
│  │  │                    │  Communication   │                                 │ │   │
│  │  │                    │     Router       │                                 │ │   │
│  │  │                    │ (Email/Chat/GH)  │                                 │ │   │
│  │  │                    └──────────────────┘                                 │ │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           DASHBOARD (Frontend)                                │   │
│  │                                                                                │   │
│  │  ┌──────────────────────────────────────────────────────────────────────────┐│   │
│  │  │  Next.js 14 + React 18 + TypeScript + TailwindCSS + Shadcn/ui           ││   │
│  │  │                                                                          ││   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ││   │
│  │  │  │  Ticket  │  │  Video   │  │ Analytics│  │ Settings │  │ GitHub   │  ││   │
│  │  │  │   List   │  │  Player  │  │Dashboard │  │  Panel   │  │ Sync     │  ││   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  ││   │
│  │  └──────────────────────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           INTEGRATIONS                                         │   │
│  │                                                                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   GitHub    │  │    Jira     │  │   Notion    │  │     HubSpot         │  │   │
│  │  │ (Issues,    │  │ (Tickets,  │  │  (Docs,     │  │   (CRM, Comms)      │  │   │
│  │  │  Blame)     │  │  Boards)    │  │  KB)        │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Stack technique

### SDK Client

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Web SDK** | TypeScript + Vite | Bundle leger, tree-shaking, SSR compatible |
| **Desktop SDK** | Rust (Tauri) / Electron | Tauri: 10x plus leger, Electron: ecosysteme mature |
| **Screen Recording** | `MediaRecorder API` (web), `FFmpeg` (desktop) | Standards natifs, compression H.264/VP9 |
| **Log Capture** | Custom + `winston`/`pino` adaptors | Extensible, low overhead |
| **Offline Queue** | IndexedDB (web) / SQLite (desktop) | Persistance locale robuste |

### Backend

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Language** | TypeScript (Node.js 20+) | Productivite, ecosysteme, type safety |
| **Framework** | NestJS | Structure enterprise, DI, modulaire |
| **API Gateway** | Kong / AWS API Gateway | Rate limiting, auth, routing multi-tenant |
| **Message Queue** | BullMQ (Redis-based) | Simple pour MVP, scalable |
| **Primary DB** | PostgreSQL 15+ (avec RLS) | Multi-tenant natif, JSONB, maturite |
| **Cache** | Redis 7+ | Session, rate limiting, pub/sub |
| **Search** | PostgreSQL Full-text + pgvector | Simplifie pour MVP |
| **Object Storage** | S3 / MinIO (self-hosted) | Videos, fichiers, scalabilite |

### AI/ML

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Video Frame Extraction** | FFmpeg | Standard industrie, fiable |
| **OCR** | Tesseract / EasyOCR | Open source, gratuit |
| **Vision Analysis** | OpenAI GPT-4 Vision | Multi-modal, comprehension contextuelle |
| **Classification** | GPT-3.5-turbo | Cout/qualite optimal |
| **Embeddings** | OpenAI Ada-002 | Recherche semantique |

### Frontend Dashboard

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Framework** | Next.js 14 (App Router) | SSR, API routes, performance |
| **UI** | React 18 + Shadcn/ui + TailwindCSS | Modern, accessible, customizable |
| **State** | TanStack Query + Zustand | Server state + local state |
| **Video Player** | Video.js | Streaming adaptatif, timeline sync |
| **Charts** | Recharts | Dashboard analytics |

### Infrastructure

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Container** | Docker + Docker Compose | Dev local simple |
| **CI/CD** | GitHub Actions | Integre au workflow |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) | MVP rapide |

---

## Modele de donnees

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-TENANT CORE
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    plan            VARCHAR(50) DEFAULT 'free',
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'member',
    password_hash   VARCHAR(255),
    auth_provider   VARCHAR(50),
    auth_provider_id VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    platform        VARCHAR(50),
    sdk_key         VARCHAR(255) UNIQUE NOT NULL,
    settings        JSONB DEFAULT '{}',
    github_repo     VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- TICKETS & REPORTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE tickets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    application_id  UUID NOT NULL REFERENCES applications(id),
    reporter_id     UUID REFERENCES users(id),
    
    -- Status & Classification
    status          VARCHAR(50) DEFAULT 'new',
    type            VARCHAR(50),
    type_confidence DECIMAL(3,2),
    severity        VARCHAR(50),
    severity_confidence DECIMAL(3,2),
    priority        INTEGER DEFAULT 0,
    
    -- Content
    title           VARCHAR(500),
    description     TEXT,
    reproduction_steps JSONB,
    
    -- User Context
    user_context    JSONB,
    session_id      VARCHAR(255),
    
    -- AI Analysis
    ai_summary      TEXT,
    ai_analysis     JSONB,
    keywords        TEXT[],
    embedding       vector(1536),
    
    -- Assignment
    assigned_to     UUID REFERENCES users(id),
    assigned_at     TIMESTAMPTZ,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

-- Enable Row-Level Security
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tickets
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════════════════
-- MEDIA & ARTIFACTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE media (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    
    -- Storage
    storage_key     VARCHAR(500) NOT NULL,
    storage_url     VARCHAR(1000),
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    duration_ms     INTEGER,
    
    -- Processing Status
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_error  TEXT,
    
    -- Metadata
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id        UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    timestamp_ms    INTEGER NOT NULL,
    event_type      VARCHAR(50),
    event_data      JSONB,
    screenshot_key  VARCHAR(500),
    ocr_text        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- GITHUB INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE github_connections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    installation_id BIGINT NOT NULL,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    repos           JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE github_issues (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID REFERENCES tickets(id),
    github_issue_number INTEGER NOT NULL,
    github_repo     VARCHAR(255) NOT NULL,
    github_issue_url VARCHAR(500),
    sync_status     VARCHAR(50) DEFAULT 'synced',
    last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(github_repo, github_issue_number)
);

-- ═══════════════════════════════════════════════════════════════════════
-- AI AGENT & CONVERSATIONS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE agent_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id),
    status          VARCHAR(50) DEFAULT 'active',
    agent_state     JSONB DEFAULT '{}',
    last_action_at  TIMESTAMPTZ DEFAULT NOW(),
    escalated_to    UUID REFERENCES users(id),
    escalation_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES agent_sessions(id),
    role            VARCHAR(50) NOT NULL,
    content         TEXT NOT NULL,
    channel         VARCHAR(50),
    external_id     VARCHAR(255),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- FEEDBACK & LEARNING
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE classification_feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES tickets(id),
    field           VARCHAR(50) NOT NULL,
    original_value  VARCHAR(100),
    corrected_value VARCHAR(100),
    corrected_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_application ON tickets(application_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_type ON tickets(type);
CREATE INDEX idx_tickets_severity ON tickets(severity);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX idx_tickets_embedding ON tickets USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_tickets_keywords ON tickets USING gin(keywords);

CREATE INDEX idx_media_ticket ON media(ticket_id);
CREATE INDEX idx_video_events_media ON video_events(media_id);
CREATE INDEX idx_video_events_timestamp ON video_events(media_id, timestamp_ms);

CREATE INDEX idx_github_issues_ticket ON github_issues(ticket_id);
CREATE INDEX idx_agent_sessions_ticket ON agent_sessions(ticket_id);
CREATE INDEX idx_agent_messages_session ON agent_messages(session_id);
```

---

## Flux de donnees

### Phase 1: Capture & Upload (SDK)

```
User clicks "Report Issue"
        │
        ▼
┌─────────────────────────────────────┐
│           SDK CLIENT                │
│                                     │
│  1. Start video recording           │
│  2. Capture system/app logs         │
│  3. Capture user events             │
│  4. Build context (OS, version...)  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    Local Queue (IndexedDB)  │   │
│  │    - Offline support        │   │
│  │    - Retry logic            │   │
│  └─────────────────────────────┘   │
│                                     │
│  5. Compress video (H.264)          │
│  6. Encrypt payload                 │
│  7. Chunked upload to S3            │
└─────────────────────────────────────┘
        │
        │ HTTPS + JWT
        ▼
```

### Phase 2: Ingestion & Validation

```
┌─────────────────────────────────────┐
│          API GATEWAY                │
│                                     │
│  - Authenticate (JWT/API Key)       │
│  - Rate limit                       │
│  - Validate payload                 │
│  - Route to upload service          │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│        UPLOAD SERVICE               │
│                                     │
│  1. Generate pre-signed S3 URL      │
│  2. Client uploads directly to S3   │
│  3. Create ticket (status: pending) │
│  4. Queue AI analysis job           │
└─────────────────────────────────────┘
        │
        ▼
    Message Queue (BullMQ)
```

### Phase 3: AI Analysis Pipeline

```
┌─────────────────────────────────────┐
│      VIDEO ANALYSIS WORKER          │
│                                     │
│  1. Extract keyframes (FFmpeg)      │
│  2. OCR on frames (Tesseract)       │
│  3. Detect errors/UI issues         │
│  4. Send to GPT-4 Vision            │
│     - Generate summary              │
│     - Estimate severity             │
│     - Classify type                 │
│     - Extract repro steps           │
│  5. Generate embeddings             │
│  6. Update ticket in DB             │
└─────────────────────────────────────┘
        │
        ▼
    Ticket ready for dashboard
```

### Phase 4: Agent Processing

```
┌─────────────────────────────────────┐
│        AI SUPPORT AGENT             │
│                                     │
│  State Machine:                     │
│  ANALYZING → NEEDS_INFO → PROPOSING │
│      │           │           │      │
│      └─────────────────────────┘    │
│                  │                  │
│      ┌───────────┼───────────┐      │
│      ▼           ▼           ▼      │
│  RESOLVED   ESCALATED   WAITING     │
│                                     │
│  Actions:                           │
│  - Ask clarifying questions         │
│  - Propose solutions                │
│  - Create GitHub issues             │
│  - Escalate to humans               │
└─────────────────────────────────────┘
```

---

## Decoupage MVP / V1 / V2

### MVP (4-6 semaines)

**Objectif**: Validation du concept - "Ca fonctionne"

| Composant | Scope |
|-----------|-------|
| **SDK Web** | Bouton + capture video (MediaRecorder) + contexte basique |
| **Backend** | Upload S3, API CRUD tickets, auth JWT simple |
| **AI** | GPT-4 Vision pour analyse + classification basique |
| **Dashboard** | Liste tickets, lecture video, statut manuel |
| **Multi-tenant** | Isolation par API key, 1 plan |

**Livrable**: Un utilisateur peut reporter un bug avec video, l'IA genere un resume, le support voit le ticket.

### V1 (3-4 mois)

**Objectif**: Production-ready - "Ca scale"

| Composant | Ajouts |
|-----------|--------|
| **SDK** | Desktop (Electron), offline queue, logs systeme |
| **Backend** | Workers separes, rate limiting avance |
| **AI** | Classification multi-modele, embeddings, recherche semantique |
| **Dashboard** | Timeline video synchronisee, filtres avances, analytics |
| **GitHub** | Connexion OAuth, recherche issues, creation auto |
| **Agent** | V1 basique: propose solutions, escalade |

### V2 (6+ mois)

**Objectif**: Enterprise-grade - "Ca impressionne"

| Composant | Ajouts |
|-----------|--------|
| **SDK** | Mobile (React Native), browser extension, plugins |
| **AI** | Fine-tuned classifiers, code blame intelligent |
| **Agent** | Autonome complet, multi-canal (email, Slack) |
| **Integrations** | Jira, Notion, HubSpot, Linear |
| **Enterprise** | SSO, audit logs, custom AI models |

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Cout AI explosif** | Budget | Cache agressif, tier rules→ML→LLM, limites par tenant |
| **Latence video upload** | UX | Chunked upload, compression client, progress feedback |
| **Qualite classification** | Valeur | Hybrid rules+ML+LLM, human-in-the-loop, feedback loop |
| **RGPD / Data privacy** | Legal | PII detection, retention policies, encryption |
| **Multi-tenant isolation** | Securite | Row-Level Security, audit logging |
| **Agent IA "hallucine"** | Reputation | Guardrails, escalation rapide, confidence thresholds |

---

## Modele SaaS

### Plans tarifaires

| Plan | Prix | Inclus |
|------|------|--------|
| **Free** | 0€ | 50 tickets/mois, 1 app, 5 min video max |
| **Pro** | 49€/mois | 500 tickets, 5 apps, 30 min video, GitHub sync |
| **Team** | 199€/mois | 2000 tickets, 20 apps, illimite video, Agent complet |
| **Enterprise** | Custom | Illimite, SSO, Audit, Custom AI, SLA |

### Metriques a tracker

- **Acquisition**: Signups, Activation rate
- **Engagement**: Tickets/user, Video completion rate
- **Value**: Time-to-resolution, AI accuracy
- **Revenue**: MRR, Churn, LTV, CAC

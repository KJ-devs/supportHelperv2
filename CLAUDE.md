# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Support Helper Platform** - an AI-powered technical support system that enables users to report bugs with video capture and automatic analysis. It's a monorepo built with TypeScript, featuring a NestJS backend API, Next.js dashboard, and a web SDK for client integration.

## Development Commands

### Initial Setup
```bash
pnpm install                    # Install all dependencies
cp .env.example .env.local      # Configure environment
pnpm docker:up                  # Start PostgreSQL, Redis, MinIO
pnpm db:migrate                 # Run database migrations
pnpm db:seed                    # Seed test data
```

### Development
```bash
pnpm dev                        # Start all services (API on :3001, Dashboard on :3000)
pnpm build                      # Build all packages
pnpm lint                       # Lint all packages
pnpm test                       # Run tests
pnpm format                     # Format code with Prettier
```

### Database
```bash
pnpm db:migrate                 # Create and apply migrations
pnpm db:generate                # Generate Prisma client
pnpm db:studio                  # Open Prisma Studio GUI
pnpm db:seed                    # Seed database with test data
```

### Package-Specific Commands
```bash
# Work with specific packages
pnpm --filter @support-helper/api [command]
pnpm --filter @support-helper/dashboard [command]
pnpm --filter @support-helper/sdk-web [command]

# Examples
pnpm --filter @support-helper/api build
pnpm --filter @support-helper/api test
```

### Testing
```bash
pnpm test                       # Run all tests
pnpm test:watch                 # Watch mode
pnpm --filter @support-helper/api test:e2e   # E2E tests
```

## Architecture

### Monorepo Structure
- **apps/api/** - NestJS backend with Prisma ORM
- **apps/dashboard/** - Next.js 14 dashboard (App Router)
- **packages/sdk-web/** - Web SDK for client integration
- **packages/shared/** - Shared TypeScript types and utilities
- **packages/database/** - Database-related utilities

### Backend (NestJS) - apps/api/src/

**Module Organization:**
- **auth/** - JWT authentication, login/register endpoints
- **tickets/** - Ticket CRUD, includes SDK endpoint at `/api/sdk/tickets`
- **media/** - S3/MinIO file uploads with pre-signed URLs
- **users/** - User management
- **tenants/** - Multi-tenant isolation
- **applications/** - Application (SDK key) management
- **ai/** - OpenAI integration for video analysis
- **health/** - Health check endpoint
- **prisma/** - Database service (singleton PrismaClient)

**Key Patterns:**
- Uses NestJS modules with dependency injection
- All services are scoped to tenant (multi-tenant via Row-Level Security)
- Authentication: JWT for dashboard users, SDK key (x-sdk-key header) for SDK clients
- Guards: `JwtAuthGuard` for dashboard, `SdkKeyGuard` for SDK endpoints
- Swagger docs auto-generated at `/api/docs`

### Database Schema (Prisma)

**Core Models:**
- **Tenant** - Top-level isolation boundary
- **User** - Dashboard users (linked to tenant)
- **Application** - Each app gets an SDK key
- **Ticket** - Bug reports with AI analysis fields
- **Media** - Video/screenshot storage (S3 keys)
- **GithubIssue** - Links tickets to GitHub issues
- **AgentSession** - AI agent conversation state
- **ClassificationFeedback** - Human corrections for ML training

**Important Schema Features:**
- PostgreSQL extensions: `uuid-ossp`, `pgvector`
- Multi-tenant isolation: All tenant-scoped tables have `tenantId`
- AI fields on Ticket: `aiSummary`, `aiAnalysis`, `keywords`, `typeConfidence`, `severityConfidence`
- Media processing status: `pending`, `processing`, `completed`, `failed`

### Frontend (Next.js) - apps/dashboard/

- Uses **App Router** (not Pages Router)
- Client components need `'use client'` directive
- Uses TanStack Query for server state
- Zustand for local state management
- TailwindCSS for styling

### SDK (packages/sdk-web/)

- Exports `SupportHelper` class
- Captures video using `MediaRecorder` API
- Collects user context (OS, browser, viewport)
- Posts to `/api/sdk/tickets` with `x-sdk-key` header
- Handles offline queuing with IndexedDB

## Development Guidelines

### Adding New Features

**NestJS Modules:**
```bash
cd apps/api
nest generate module feature-name
nest generate service feature-name
nest generate controller feature-name
```

**Database Changes:**
1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm db:migrate` to create migration
3. Run `pnpm db:generate` to update Prisma client
4. Update seed file if needed: `apps/api/prisma/seed.ts`

**New Dashboard Pages:**
- Create in `apps/dashboard/app/[route]/page.tsx`
- Use `'use client'` for interactive components
- Fetch data with TanStack Query

### Multi-Tenant Considerations

All data access must be tenant-scoped:
- API routes check user's `tenantId` from JWT
- SDK endpoints lookup tenant via SDK key
- Database queries filter by `tenantId`
- Row-Level Security (RLS) enforced at DB level (planned)

### Authentication Flow

**Dashboard Users:**
1. POST `/api/auth/login` → JWT token
2. Include token in `Authorization: Bearer <token>` header
3. Protected routes use `@UseGuards(JwtAuthGuard)`

**SDK Clients:**
1. Get SDK key from Application settings
2. Include in `x-sdk-key` header
3. SDK routes use `@UseGuards(SdkKeyGuard)`

### File Upload Pattern

1. Client requests pre-signed URL: `POST /api/media/upload-url`
2. API returns S3 pre-signed URL + media record ID
3. Client uploads directly to S3
4. Client confirms upload: `POST /api/media/:id/confirm`
5. Backend queues video for AI analysis

### AI Analysis Pipeline

1. Video uploaded to S3
2. Worker extracts keyframes with FFmpeg
3. OCR on frames (Tesseract)
4. Send frames to GPT-4 Vision API
5. Generate summary, classify severity/type
6. Update ticket with AI analysis
7. Status changes: `pending` → `analyzing` → `analyzed`

## Code Style

- TypeScript strict mode enabled
- Use `async/await` over promises
- NestJS uses decorators: `@Injectable()`, `@Controller()`, `@Get()`, etc.
- DTOs use `class-validator` decorators: `@IsString()`, `@IsOptional()`, etc.
- Prisma uses `PrismaService` injected via constructor
- Error handling: throw NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.)

## Environment Variables

Key variables (see `.env.example` for full list):
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key (optional for MVP)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` - MinIO/S3 config
- `API_PORT` - API port (default 3001)
- `DASHBOARD_URL` - CORS origin for dashboard

## Testing

- Unit tests: `*.spec.ts` files
- E2E tests: `test/*.e2e-spec.ts`
- Use `@nestjs/testing` for NestJS module testing
- Mock PrismaService for unit tests
- Seed database before E2E tests

## Common Pitfalls

1. **Prisma Client Not Generated** - Run `pnpm db:generate` after schema changes
2. **Port Conflicts** - Default ports: API=3001, Dashboard=3000, PostgreSQL=5432, Redis=6379, MinIO=9000
3. **CORS Issues** - Ensure `DASHBOARD_URL` in `.env.local` matches frontend URL
4. **Multi-Tenant Bugs** - Always filter by `tenantId` in queries
5. **SDK Key vs JWT** - SDK endpoints use `x-sdk-key` header, dashboard uses JWT Bearer token
6. **Turbo Cache** - Run `pnpm clean` if builds behave unexpectedly

## Key Files Reference

- `apps/api/src/main.ts` - API entry point, Swagger setup, CORS config
- `apps/api/src/app.module.ts` - Root module, imports all feature modules
- `apps/api/prisma/schema.prisma` - Database schema
- `apps/api/prisma/seed.ts` - Test data seeding
- `turbo.json` - Turborepo pipeline configuration
- `pnpm-workspace.yaml` - Monorepo workspace definition
- `docker-compose.yml` - Infrastructure services

## Resources

- API Documentation: http://localhost:3001/api/docs (Swagger UI)
- Database GUI: `pnpm db:studio`
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- Architecture Details: See `ARCHITECTURE.md`
- Quick Commands: See `QUICK_REFERENCE.md`

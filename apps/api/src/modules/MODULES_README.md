# Modules Documentation

## Overview

This document describes the core business logic modules: **Tickets** and **Media**.

---

## Tickets Module

### Architecture

```
tickets/
├── dto/                        # Data Transfer Objects
│   ├── create-ticket.dto.ts
│   ├── update-ticket.dto.ts
│   ├── filter-tickets.dto.ts  # TanStack Query compatible
│   ├── search-tickets.dto.ts  # Meilisearch
│   └── assign-ticket.dto.ts
│
├── tickets.service.ts          # Main CRUD service
├── tickets-search.service.ts   # Meilisearch integration
├── tickets-ai.service.ts       # AI analysis & vector search
│
├── tickets.controller.ts       # Dashboard API
├── sdk-tickets.controller.ts   # SDK API (x-sdk-key auth)
└── tickets.module.ts
```

### Services

#### TicketsService

Main service handling CRUD operations with tenant isolation.

**Key Methods:**
```typescript
create(tenantId, dto, reporterId?)        // Create ticket
findAll(tenantId, filters)                // List with pagination
findOne(ticketId, tenantId)               // Get single ticket
update(ticketId, tenantId, dto)           // Update ticket
remove(ticketId, tenantId)                // Soft delete
assign(ticketId, tenantId, userId)        // Assign to user
getStats(tenantId)                        // Statistics
```

**Filtering:**
- Status, type, severity
- Application, assigned user, reporter
- Date range (createdFrom/createdTo)
- Search in title/description
- Pagination & sorting (TanStack Query compatible)

#### TicketsSearchService

Meilisearch integration for full-text search.

**Key Methods:**
```typescript
indexTicket(ticket)          // Add/update in index
removeTicket(ticketId)       // Remove from index
search(tenantId, dto)        // Full-text search
bulkIndex(tickets)           // Bulk indexing
```

**Search Features:**
- Full-text search in title, description, AI summary
- Filter by status, severity, type
- Highlighted results
- Fast (< 50ms response time)

#### TicketsAIService

AI analysis and vector similarity search.

**Key Methods:**
```typescript
enqueueAnalysis(ticketId, priority)    // Queue AI job
findSimilar(ticketId, tenantId, limit) // Vector search
updateKeywords(ticketId, keywords)     // Update keywords
storeEmbedding(ticketId, embedding)    // Store vector
```

**Vector Search:**
- Uses pgvector extension
- OpenAI ada-002 embeddings (1536 dimensions)
- Cosine similarity
- Fallback to keyword search if vector not available

### API Endpoints

#### Dashboard API (JWT Auth)

```
POST   /api/tickets              Create ticket
GET    /api/tickets              List tickets (paginated)
GET    /api/tickets/stats        Get statistics
GET    /api/tickets/search       Full-text search
GET    /api/tickets/:id          Get ticket details
GET    /api/tickets/:id/similar  Find similar tickets
PATCH  /api/tickets/:id          Update ticket
POST   /api/tickets/:id/assign   Assign to user
DELETE /api/tickets/:id          Delete (soft)
```

#### SDK API (x-sdk-key Auth)

```
POST   /api/sdk/tickets          Create ticket from client SDK
```

### Usage Examples

#### Create Ticket (Dashboard)

```typescript
POST /api/tickets
Authorization: Bearer <jwt-token>

{
  "title": "Login button not working",
  "description": "When I click login, nothing happens",
  "applicationId": "uuid",
  "userContext": {
    "os": "Windows 11",
    "browser": "Chrome 120",
    "viewport": { "width": 1920, "height": 1080 }
  },
  "reproductionSteps": [
    "Go to /login",
    "Enter credentials",
    "Click login button"
  ]
}
```

#### List Tickets (Paginated)

```typescript
GET /api/tickets?page=0&limit=20&status=open&severity=high&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <jwt-token>

Response:
{
  "data": [...],
  "pagination": {
    "page": 0,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

#### Search Tickets

```typescript
GET /api/tickets/search?query=login+button&status=open,new&limit=10
Authorization: Bearer <jwt-token>

Response:
{
  "hits": [...],
  "totalHits": 42,
  "query": "login button",
  "processingTimeMs": 12
}
```

#### Find Similar Tickets

```typescript
GET /api/tickets/:id/similar?limit=5
Authorization: Bearer <jwt-token>

Response: [
  {
    "id": "uuid",
    "title": "Login form not submitting",
    "similarity": 0.87,
    ...
  }
]
```

#### Create from SDK

```typescript
POST /api/sdk/tickets
x-sdk-key: <your-sdk-key>

{
  "title": "Crash on startup",
  "description": "App crashes immediately after launch",
  "userContext": {
    "os": "macOS 14",
    "version": "1.2.3"
  }
}
```

---

## Media Module

### Architecture

```
media/
├── dto/
│   ├── request-upload-url.dto.ts
│   └── complete-upload.dto.ts
│
├── s3.service.ts          # AWS S3 client (SDK v3)
├── media.service.ts       # Media management
├── media.controller.ts
└── media.module.ts
```

### Services

#### S3Service

AWS S3 client with presigned URL generation.

**Key Methods:**
```typescript
getPresignedUploadUrl(key, contentType, expiresIn)   // Upload URL
getPresignedDownloadUrl(key, expiresIn)              // Download URL
objectExists(key)                                     // Check existence
getObjectMetadata(key)                                // Get metadata
deleteObject(key)                                     // Delete file
generateStorageKey(tenantId, ticketId, filename)     // Generate key
```

**Storage Structure:**
```
{tenantId}/{ticketId}/{uuid}.{extension}
```

#### MediaService

Media file management with validation and AI analysis queuing.

**Key Methods:**
```typescript
requestUploadUrl(tenantId, dto)          // Generate presigned URL
completeUpload(tenantId, dto)            // Finalize upload
findByTicket(ticketId, tenantId)         // Get ticket media
findOne(mediaId, tenantId)               // Get single media
remove(mediaId, tenantId)                // Delete media
cleanupPendingUploads()                  // Cleanup orphans
```

**File Size Limits:**
- Free: 500MB
- Pro: 5GB
- Team: 10GB
- Enterprise: 50GB

**Supported File Types:**
- Video: mp4, webm, mov (quicktime)
- Image: png, jpg, jpeg, gif

### API Endpoints

```
POST   /api/media/presigned-url     Request upload URL
POST   /api/media/complete           Complete upload
GET    /api/media/ticket/:ticketId   Get ticket media
GET    /api/media/:id                Get media details
DELETE /api/media/:id                Delete media
```

### Upload Flow

```
┌─────────┐                  ┌─────────┐                  ┌──────────┐
│ Client  │                  │   API   │                  │   S3     │
└────┬────┘                  └────┬────┘                  └────┬─────┘
     │                            │                            │
     │  1. Request presigned URL  │                            │
     │ ──────────────────────────>│                            │
     │     POST /media/presigned-url                           │
     │     {ticketId, type, ...}  │                            │
     │                            │                            │
     │                            │ 2. Validate & create       │
     │                            │    media record (pending)  │
     │                            │                            │
     │                            │ 3. Generate presigned URL  │
     │                            │ ──────────────────────────>│
     │                            │                            │
     │ <──────────────────────────│                            │
     │  {uploadUrl, mediaId, ...} │                            │
     │                            │                            │
     │  4. Upload file directly   │                            │
     │ ───────────────────────────────────────────────────────>│
     │                            │                            │
     │  5. Complete callback      │                            │
     │ ──────────────────────────>│                            │
     │     POST /media/complete   │                            │
     │     {mediaId, storageKey}  │                            │
     │                            │                            │
     │                            │ 6. Verify file exists      │
     │                            │ ──────────────────────────>│
     │                            │ <──────────────────────────│
     │                            │                            │
     │                            │ 7. Update status & enqueue │
     │                            │    AI analysis job         │
     │                            │                            │
     │ <──────────────────────────│                            │
     │  {success: true}           │                            │
     │                            │                            │
```

### Usage Examples

#### Step 1: Request Upload URL

```typescript
POST /api/media/presigned-url
Authorization: Bearer <jwt-token>

{
  "ticketId": "uuid",
  "type": "video",
  "filename": "recording.webm",
  "size": 50000000,
  "contentType": "video/webm"
}

Response:
{
  "mediaId": "uuid",
  "uploadUrl": "https://s3.../presigned-url",
  "storageKey": "{tenantId}/{ticketId}/{uuid}.webm",
  "expiresIn": 3600,
  "maxSize": 524288000
}
```

#### Step 2: Upload to S3 (Client-side)

```typescript
// Use the presigned URL to upload directly to S3
const response = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': contentType,
  },
});
```

#### Step 3: Complete Upload

```typescript
POST /api/media/complete
Authorization: Bearer <jwt-token>

{
  "mediaId": "uuid",
  "storageKey": "{tenantId}/{ticketId}/{uuid}.webm"
}

Response:
{
  "success": true,
  "media": {
    "id": "uuid",
    "type": "video",
    "status": "processing"
  }
}
```

#### Get Ticket Media

```typescript
GET /api/media/ticket/:ticketId
Authorization: Bearer <jwt-token>

Response: [
  {
    "id": "uuid",
    "type": "video",
    "mimeType": "video/webm",
    "fileSize": 50000000,
    "processingStatus": "completed",
    "downloadUrl": "https://s3.../presigned-download-url",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

---

## Integration

### Tickets + Media Flow

1. **Create Ticket**
   ```typescript
   POST /api/tickets
   → Returns: { id: ticketId }
   ```

2. **Request Upload URL**
   ```typescript
   POST /api/media/presigned-url
   Body: { ticketId, ... }
   → Returns: { uploadUrl, mediaId }
   ```

3. **Upload to S3** (direct from client)

4. **Complete Upload**
   ```typescript
   POST /api/media/complete
   Body: { mediaId, storageKey }
   → Enqueues AI analysis job
   ```

5. **AI Worker Processes** (async)
   - Extracts video frames
   - Runs OCR
   - Analyzes with GPT-4 Vision
   - Updates ticket with AI summary

6. **View Results**
   ```typescript
   GET /api/tickets/:id
   → Returns ticket with aiSummary, severity, type

   GET /api/media/ticket/:ticketId
   → Returns media with download URLs
   ```

### Meilisearch Integration

Automatic indexing on ticket create/update:

```typescript
// In controller
const ticket = await ticketsService.create(...);
await ticketsSearchService.indexTicket(ticket);  // ← Automatic
```

### BullMQ Jobs

**Ticket Analysis Queue:**
```typescript
Queue: 'ticket-analysis'
Job: 'analyze-ticket'
Data: { ticketId, timestamp }
Priority: 5 (1=highest, 10=lowest)
```

**Video Analysis Queue:**
```typescript
Queue: 'video-analysis'
Job: 'analyze-video'
Data: { mediaId, ticketId, timestamp }
Priority: 5
```

---

## Error Handling

### Common Errors

**404 Not Found:**
- Ticket not found
- Media not found
- File not found in S3

**400 Bad Request:**
- Invalid file type
- File size exceeds limit
- Storage key mismatch
- File validation failed

**403 Forbidden:**
- User not in tenant
- Cannot assign to user in different tenant

**500 Internal Server Error:**
- S3 connection failed
- Meilisearch unavailable
- Database error

### Validation

All DTOs use `class-validator`:
```typescript
@IsString()
@IsNotEmpty()
@MaxLength(500)
title: string;

@IsUUID()
@IsOptional()
applicationId?: string;
```

---

## Performance Considerations

### Pagination

Always use pagination for large result sets:
```typescript
{
  page: 0,      // 0-indexed
  limit: 20,    // Max 100
  sortBy: 'createdAt',
  sortOrder: 'desc'
}
```

### Search

- Meilisearch < 50ms for most queries
- Fallback to PostgreSQL if Meilisearch unavailable
- Indexed fields: title, description, aiSummary, keywords

### Vector Search

- Requires pgvector extension
- Embeddings generated by AI worker (async)
- Fallback to keyword search if embedding not available

### Caching

- Presigned URLs cached for 1 hour
- Download URLs generated on-demand
- Queue stats can be cached for 1 minute

---

## Testing

Run tests:
```bash
# Unit tests
pnpm --filter @support-helper/api test

# E2E tests
pnpm --filter @support-helper/api test:e2e

# Coverage
pnpm --filter @support-helper/api test:cov
```

Mock services in tests:
```typescript
const mockPrismaService = {
  ticket: {
    create: jest.fn(),
    findMany: jest.fn(),
    // ...
  },
};

const mockS3Service = {
  getPresignedUploadUrl: jest.fn(),
  // ...
};
```

---

## Deployment

### Environment Variables

Required:
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Optional:
```env
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=...
OPENAI_API_KEY=sk-...
```

### Scaling

**Horizontal Scaling:**
- API instances: Stateless, can scale freely
- Workers: Scale based on queue size

**Queue Monitoring:**
```typescript
GET /api/tickets/queue-stats  // Add this endpoint
{
  waiting: 42,
  active: 3,
  completed: 1250,
  failed: 5
}
```

**Database Optimization:**
- Indexes on frequently queried fields
- Partitioning by tenantId for large datasets
- Connection pooling (Prisma default)

---

## Troubleshooting

### Uploads Failing

1. Check S3 credentials
2. Verify bucket exists and is accessible
3. Check CORS settings
4. Verify presigned URL not expired

### Search Not Working

1. Check Meilisearch is running
2. Verify index exists: `curl http://localhost:7700/indexes`
3. Re-index tickets: `POST /api/tickets/reindex` (add this endpoint)

### AI Analysis Not Running

1. Check Redis is running
2. Verify BullMQ worker is running
3. Check queue stats
4. Review worker logs

---

## Future Enhancements

- [ ] Chunked upload support for large files
- [ ] Progress tracking for uploads
- [ ] Batch operations (bulk delete, bulk assign)
- [ ] Advanced filters (custom fields, tags)
- [ ] Export tickets to CSV/PDF
- [ ] Real-time updates via WebSocket
- [ ] Ticket templates
- [ ] SLA tracking
- [ ] Custom ticket statuses per tenant

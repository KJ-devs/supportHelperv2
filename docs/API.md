# API Reference

Complete REST API documentation for Support Helper Platform.

**Base URL**: `http://localhost:3001/api`
**Interactive Docs**: [Swagger UI](http://localhost:3001/api/docs)

---

## Table of Contents

- [Authentication](#authentication)
- [Auth](#auth)
- [Users](#users)
- [Tenants](#tenants)
- [Applications](#applications)
- [Tickets](#tickets)
- [SDK Tickets](#sdk-tickets)
- [Media](#media)
- [AI Agent](#ai-agent)
- [Analytics](#analytics)
- [Classification Feedback](#classification-feedback)
- [GitHub OAuth](#github-oauth)
- [GitHub Repositories](#github-repositories)
- [GitHub Webhooks](#github-webhooks)
- [Ticket GitHub Integration](#ticket-github-integration)
- [Integrations](#integrations)
- [Health](#health)
- [Error Responses](#error-responses)

---

## Authentication

### JWT Authentication (Dashboard)

Most endpoints require a JWT Bearer token obtained via login:

```bash
# 1. Login to get tokens
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' | jq -r '.accessToken')

# 2. Use token in subsequent requests
curl http://localhost:3001/api/tickets \
  -H "Authorization: Bearer $TOKEN"
```

### SDK Key Authentication

SDK endpoints use an API key passed via the `x-sdk-key` header:

```bash
curl -X POST http://localhost:3001/api/sdk/tickets/report \
  -H "x-sdk-key: sk_live_your-sdk-key-here" \
  -F "title=Bug report" \
  -F "description=Something is broken"
```

---

## Auth

### POST /api/auth/register

Register a new user and tenant.

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "tenantName": "Acme Corp"
  }'
```

**Response** `201`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "owner"
  }
}
```

### POST /api/auth/login

Login with email and password.

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"SecurePass123!"}'
```

**Response** `200`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST /api/auth/refresh

Refresh access token.

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGciOiJIUzI1NiIs..."}'
```

### POST /api/auth/logout

Logout user (client should discard tokens). **Requires JWT.**

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/auth/me

Get current user info. **Requires JWT.**

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response** `200`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "660e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "owner",
  "tenant": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "free"
  }
}
```

---

## Users

All endpoints require JWT authentication.

### GET /api/users

List all users in tenant.

```bash
curl http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/users/:id

Get user by ID.

```bash
curl http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/users

Create/invite a new user (requires owner or admin role).

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Smith",
    "password": "TempPass123!",
    "role": "agent"
  }'
```

### PATCH /api/users/:id

Update user (role changes require owner or admin).

```bash
curl -X PATCH http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### DELETE /api/users/:id

Delete user (requires owner or admin role).

```bash
curl -X DELETE http://localhost:3001/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/users/profile

Update current user profile.

```bash
curl -X PATCH http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John D.", "email": "newemail@example.com"}'
```

### PATCH /api/users/password

Change current user password.

```bash
curl -X PATCH http://localhost:3001/api/users/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "OldPass123!", "newPassword": "NewPass456!"}'
```

### PATCH /api/users/notifications

Update notification preferences.

```bash
curl -X PATCH http://localhost:3001/api/users/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailNotifications": true, "slackNotifications": false}'
```

---

## Tenants

All endpoints require JWT authentication.

### GET /api/tenants/current

Get current tenant info.

```bash
curl http://localhost:3001/api/tenants/current \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tenants/current/stats

Get current tenant statistics.

```bash
curl http://localhost:3001/api/tenants/current/stats \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/tenants/current

Update current tenant.

```bash
curl -X PATCH http://localhost:3001/api/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp Updated"}'
```

---

## Applications

All endpoints require JWT authentication.

### POST /api/applications

Create a new application.

```bash
curl -X POST http://localhost:3001/api/applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Web App", "url": "https://myapp.example.com"}'
```

**Response** `201`:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "name": "My Web App",
  "url": "https://myapp.example.com",
  "sdkKey": "sk_live_abc123def456...",
  "tenantId": "660e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2024-01-16T12:00:00Z"
}
```

### GET /api/applications

List all applications.

```bash
curl http://localhost:3001/api/applications \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/applications/:id

Get application by ID.

```bash
curl http://localhost:3001/api/applications/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/applications/:id/stats

Get application statistics.

```bash
curl http://localhost:3001/api/applications/770e8400-e29b-41d4-a716-446655440000/stats \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/applications/:id

Update application.

```bash
curl -X PATCH http://localhost:3001/api/applications/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Updated App"}'
```

### POST /api/applications/:id/regenerate-key

Regenerate SDK key.

```bash
curl -X POST http://localhost:3001/api/applications/770e8400-e29b-41d4-a716-446655440000/regenerate-key \
  -H "Authorization: Bearer $TOKEN"
```

### DELETE /api/applications/:id

Delete application.

```bash
curl -X DELETE http://localhost:3001/api/applications/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tickets

All endpoints require JWT authentication. Rate limited: 100 req/min.

### POST /api/tickets

Create a new ticket.

```bash
curl -X POST http://localhost:3001/api/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Login button not working",
    "description": "Clicking the login button does nothing on Chrome 120",
    "applicationId": "770e8400-e29b-41d4-a716-446655440000",
    "type": "bug",
    "severity": "high"
  }'
```

### GET /api/tickets

Get all tickets with filters and pagination.

```bash
# Basic list
curl "http://localhost:3001/api/tickets" \
  -H "Authorization: Bearer $TOKEN"

# With filters
curl "http://localhost:3001/api/tickets?status=open&severity=high&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tickets/stats

Get ticket statistics.

```bash
curl http://localhost:3001/api/tickets/stats \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tickets/search

Search tickets using MeiliSearch.

```bash
curl "http://localhost:3001/api/tickets/search?q=login+button&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tickets/:id

Get a ticket by ID.

```bash
curl http://localhost:3001/api/tickets/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tickets/:id/similar

Find similar tickets using vector search.

```bash
curl "http://localhost:3001/api/tickets/880e8400-e29b-41d4-a716-446655440000/similar?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/tickets/:id

Update a ticket.

```bash
curl -X PATCH http://localhost:3001/api/tickets/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "severity": "critical"}'
```

### POST /api/tickets/:id/assign

Assign ticket to a user.

```bash
curl -X POST http://localhost:3001/api/tickets/880e8400-e29b-41d4-a716-446655440000/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "550e8400-e29b-41d4-a716-446655440000"}'
```

### DELETE /api/tickets/:id

Delete a ticket (soft delete).

```bash
curl -X DELETE http://localhost:3001/api/tickets/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## SDK Tickets

SDK endpoints use `x-sdk-key` authentication. Rate limited: 50 req/min.

### POST /api/sdk/tickets

Create a ticket from SDK (client application).

```bash
curl -X POST http://localhost:3001/api/sdk/tickets \
  -H "x-sdk-key: sk_live_your-sdk-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bug in checkout flow",
    "description": "Payment form crashes on submit"
  }'
```

**Response** `201`:
```json
{
  "success": true,
  "ticket": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "title": "Bug in checkout flow",
    "status": "open",
    "createdAt": "2024-01-16T12:00:00Z"
  }
}
```

### POST /api/sdk/tickets/report

Submit a full bug report with video, description, and AI processing. Accepts multipart form data.

```bash
curl -X POST http://localhost:3001/api/sdk/tickets/report \
  -H "x-sdk-key: sk_live_your-sdk-key" \
  -F "title=Login page crashes" \
  -F "description=The login page shows a white screen after entering credentials" \
  -F "video=@recording.webm" \
  -F 'userContext={"os":"Windows 11","browser":"Chrome 120","viewport":"1920x1080"}'
```

**Response** `201`:
```json
{
  "success": true,
  "ticket": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "title": "Login page crashes",
    "status": "open",
    "createdAt": "2024-01-16T12:00:00Z"
  },
  "aiAnalysis": {
    "summary": "User reports white screen on login page after credential entry",
    "enrichedDescription": "...",
    "severity": "high",
    "severityConfidence": 0.85,
    "type": "bug",
    "typeConfidence": 0.92,
    "keywords": ["login", "white-screen", "crash"],
    "reproductionSteps": ["Navigate to login page", "Enter credentials", "Click submit"]
  },
  "video": {
    "received": true,
    "filename": "recording.webm",
    "size": 2456789,
    "mimeType": "video/webm",
    "mediaId": "990e8400-e29b-41d4-a716-446655440000",
    "storageKey": "tenant-id/ticket-id/video-1705401600.webm"
  }
}
```

---

## Media

All endpoints require JWT authentication.

### POST /api/media/presigned-url

Request presigned URL for file upload.

```bash
curl -X POST http://localhost:3001/api/media/presigned-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "880e8400-e29b-41d4-a716-446655440000",
    "fileName": "screenshot.png",
    "mimeType": "image/png",
    "fileSize": 245678
  }'
```

**Response** `201`:
```json
{
  "mediaId": "990e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "http://localhost:9000/videos/...",
  "storageKey": "tenant-id/ticket-id/screenshot.png",
  "expiresIn": 3600,
  "maxSize": 104857600
}
```

### POST /api/media/complete

Complete upload and trigger AI analysis.

```bash
curl -X POST http://localhost:3001/api/media/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mediaId": "990e8400-e29b-41d4-a716-446655440000"}'
```

### GET /api/media/ticket/:ticketId

Get all media for a ticket.

```bash
curl http://localhost:3001/api/media/ticket/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/media/:id

Get media by ID with download URL.

```bash
curl http://localhost:3001/api/media/990e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/media/:id/url

Get presigned download URL for media.

```bash
curl http://localhost:3001/api/media/990e8400-e29b-41d4-a716-446655440000/url \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/media/:mediaId/events

Get video events for a media item.

```bash
curl "http://localhost:3001/api/media/990e8400-e29b-41d4-a716-446655440000/events?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### DELETE /api/media/:id

Delete media file and record.

```bash
curl -X DELETE http://localhost:3001/api/media/990e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## AI Agent

All endpoints require JWT authentication.

### POST /api/agent/sessions/:ticketId

Start AI agent session for a ticket.

```bash
curl -X POST http://localhost:3001/api/agent/sessions/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/agent/sessions/:sessionId

Get agent session with messages.

```bash
curl http://localhost:3001/api/agent/sessions/aa0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/agent/sessions/:sessionId/messages

Send message to agent.

```bash
curl -X POST http://localhost:3001/api/agent/sessions/aa0e8400-e29b-41d4-a716-446655440000/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Can you analyze the crash logs for this ticket?"}'
```

---

## Analytics

All endpoints require JWT authentication.

### GET /api/analytics/overview

Get dashboard overview statistics.

```bash
curl "http://localhost:3001/api/analytics/overview?period=week" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/analytics/trends

Get ticket trends over time.

```bash
curl "http://localhost:3001/api/analytics/trends?period=week&days=30" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/analytics/performance

Get performance metrics.

```bash
curl http://localhost:3001/api/analytics/performance \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/analytics/agents

Get agent performance statistics.

```bash
curl http://localhost:3001/api/analytics/agents \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/analytics/applications

Get application statistics.

```bash
curl http://localhost:3001/api/analytics/applications \
  -H "Authorization: Bearer $TOKEN"
```

---

## Classification Feedback

All endpoints require JWT authentication.

### POST /api/feedback

Create classification feedback for a ticket.

```bash
curl -X POST http://localhost:3001/api/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "880e8400-e29b-41d4-a716-446655440000",
    "field": "severity",
    "originalValue": "medium",
    "correctedValue": "critical",
    "reason": "This affects all users in production"
  }'
```

### GET /api/feedback?ticketId=:ticketId

List feedback for a ticket.

```bash
curl "http://localhost:3001/api/feedback?ticketId=880e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/feedback/:id

Get single feedback by ID.

```bash
curl http://localhost:3001/api/feedback/bb0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/feedback/:id

Update feedback.

```bash
curl -X PATCH http://localhost:3001/api/feedback/bb0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"correctedValue": "high"}'
```

### DELETE /api/feedback/:id

Delete feedback.

```bash
curl -X DELETE http://localhost:3001/api/feedback/bb0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## GitHub OAuth

### GET /api/github/oauth/authorize

Get GitHub OAuth authorization URL. **Requires JWT.**

```bash
curl "http://localhost:3001/api/github/oauth/authorize?redirect=http://localhost:3000/dashboard/github" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** `200`:
```json
{
  "url": "https://github.com/login/oauth/authorize?client_id=...&state=...",
  "state": "encrypted-state-token"
}
```

### GET /api/github/oauth/callback

GitHub OAuth callback handler (called by GitHub, public endpoint).

### GET /api/github/oauth/status

Check GitHub connection status. **Requires JWT.**

```bash
curl http://localhost:3001/api/github/oauth/status \
  -H "Authorization: Bearer $TOKEN"
```

**Response** `200`:
```json
{
  "connected": true,
  "connectionId": "cc0e8400-e29b-41d4-a716-446655440000",
  "repoCount": 5,
  "createdAt": "2024-01-16T12:00:00Z"
}
```

### DELETE /api/github/oauth/disconnect

Disconnect GitHub integration. **Requires JWT.**

```bash
curl -X DELETE http://localhost:3001/api/github/oauth/disconnect \
  -H "Authorization: Bearer $TOKEN"
```

---

## GitHub Repositories

All endpoints require JWT authentication.

### GET /api/github/repos

List user repositories from GitHub.

```bash
curl "http://localhost:3001/api/github/repos?page=1&perPage=30" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/github/repos/connected

List connected repositories.

```bash
curl http://localhost:3001/api/github/repos/connected \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/github/repos/:owner/:repo

Get repository details.

```bash
curl http://localhost:3001/api/github/repos/octocat/hello-world \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/github/repos/link

Link repository to application.

```bash
curl -X POST http://localhost:3001/api/github/repos/link \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "770e8400-...", "repository": "octocat/hello-world"}'
```

### DELETE /api/github/repos/link/:applicationId

Unlink repository from application.

```bash
curl -X DELETE http://localhost:3001/api/github/repos/link/770e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

---

## GitHub Webhooks

### POST /api/github/webhooks

Handle incoming GitHub webhook events (public, signature-verified).

```bash
curl -X POST http://localhost:3001/api/github/webhooks \
  -H "Content-Type: application/json" \
  -H "x-github-event: issues" \
  -H "x-hub-signature-256: sha256=..." \
  -H "x-github-delivery: abc-123" \
  -d '{"action":"opened","issue":{...}}'
```

---

## Ticket GitHub Integration

All endpoints require JWT authentication. URLs are nested under `/api/tickets/:ticketId/github`.

### POST /api/tickets/:ticketId/github/create-issue

Create GitHub issue from ticket.

```bash
curl -X POST http://localhost:3001/api/tickets/880e8400-.../github/create-issue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repository": "octocat/hello-world", "labels": ["bug"]}'
```

### GET /api/tickets/:ticketId/github/issues

Get linked GitHub issues.

```bash
curl http://localhost:3001/api/tickets/880e8400-.../github/issues \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/tickets/:ticketId/github/related

Search related GitHub issues.

```bash
curl "http://localhost:3001/api/tickets/880e8400-.../github/related?repository=octocat/hello-world" \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/tickets/:ticketId/github/sync

Sync ticket to GitHub issues.

```bash
curl -X POST http://localhost:3001/api/tickets/880e8400-.../github/sync \
  -H "Authorization: Bearer $TOKEN"
```

### DELETE /api/tickets/:ticketId/github/issues/:issueId

Unlink GitHub issue from ticket.

```bash
curl -X DELETE http://localhost:3001/api/tickets/880e8400-.../github/issues/dd0e8400-... \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/tickets/:ticketId/github/user-story

Create GitHub User Story from ticket.

```bash
curl -X POST http://localhost:3001/api/tickets/880e8400-.../github/user-story \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repository": "octocat/hello-world"}'
```

---

## Integrations

All endpoints require JWT authentication. Supports Jira, HubSpot, Slack, Notion, Discord.

### POST /api/integrations

Create a new integration.

```bash
curl -X POST http://localhost:3001/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "jira",
    "name": "Jira Cloud",
    "config": {
      "baseUrl": "https://mycompany.atlassian.net",
      "email": "user@example.com",
      "apiToken": "jira-api-token",
      "projectKey": "SUP"
    }
  }'
```

### GET /api/integrations

List all integrations.

```bash
curl "http://localhost:3001/api/integrations?type=jira&enabled=true" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/integrations/types

Get available integration types.

```bash
curl http://localhost:3001/api/integrations/types \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/integrations/:id

Get integration details.

```bash
curl http://localhost:3001/api/integrations/ee0e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

### PATCH /api/integrations/:id

Update an integration.

```bash
curl -X PATCH http://localhost:3001/api/integrations/ee0e8400-... \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Jira", "enabled": false}'
```

### DELETE /api/integrations/:id

Delete an integration.

```bash
curl -X DELETE http://localhost:3001/api/integrations/ee0e8400-... \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/integrations/:id/test

Test integration connection.

```bash
curl -X POST http://localhost:3001/api/integrations/ee0e8400-.../test \
  -H "Authorization: Bearer $TOKEN"
```

### POST /api/integrations/:id/sync

Manually trigger sync (push, pull, or both).

```bash
curl -X POST http://localhost:3001/api/integrations/ee0e8400-.../sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"direction": "both", "ticketIds": ["880e8400-..."]}'
```

### GET /api/integrations/:id/logs

Get sync logs for an integration.

```bash
curl "http://localhost:3001/api/integrations/ee0e8400-.../logs?page=0&limit=20&status=success" \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/integrations/:id/stats

Get sync statistics for an integration.

```bash
curl http://localhost:3001/api/integrations/ee0e8400-.../stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## Health

### GET /api/health

Basic health check (public, no auth required).

```bash
curl http://localhost:3001/api/health
```

**Response** `200`:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-16T12:00:00Z",
  "uptime": 12345,
  "version": "0.1.0"
}
```

### GET /api/health/live

Kubernetes liveness probe (public).

```bash
curl http://localhost:3001/api/health/live
```

### GET /api/health/ready

Kubernetes readiness probe (public).

```bash
curl http://localhost:3001/api/health/ready
```

### GET /api/health/full

Full health check with all dependencies. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/full \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/health/db

Database health check. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/db \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/health/redis

Redis health check. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/redis \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/health/cron

Cron jobs status. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/cron \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/health/queues

Queue status. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/queues \
  -H "Authorization: Bearer $TOKEN"
```

### GET /api/health/metrics

Basic process metrics. **Requires JWT.**

```bash
curl http://localhost:3001/api/health/metrics \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid input or validation error |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource does not exist |
| `409` | Conflict - Resource already exists (e.g., duplicate email) |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |

### Rate Limiting

| Scope | Limit |
|-------|-------|
| Public endpoints (login, register) | 10 req/min |
| Authenticated endpoints | 100 req/min |
| SDK endpoints | 50 req/min |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705401660
```

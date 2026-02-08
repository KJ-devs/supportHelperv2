# API Reference

<div align="center">

Complete REST API documentation for Support Helper.

[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-85EA2D?style=flat-square&logo=openapi-initiative&logoColor=white)](http://localhost:3001/api/docs)
[![Swagger](https://img.shields.io/badge/Swagger-UI-85EA2D?style=flat-square&logo=swagger&logoColor=white)](http://localhost:3001/api/docs)

**Interactive Documentation**: Access Swagger UI at `http://localhost:3001/api/docs` when running locally.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Tickets](#tickets)
  - [Media](#media)
  - [Applications](#applications)
  - [Users](#users)
  - [GitHub](#github)
  - [SDK](#sdk-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)

## Overview

### Base URL

```
Development: http://localhost:3001/api
Production:  https://api.support-helper.com/api
```

### Request Format

- Content-Type: `application/json`
- All timestamps in ISO 8601 format
- UUIDs for all IDs

### Response Format

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## Authentication

### JWT Authentication (Dashboard)

Used for dashboard users.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Obtaining a token:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "tenantId": "uuid"
  }
}
```

### SDK Key Authentication

Used for SDK clients (web applications).

**Headers:**
```
x-sdk-key: sk_live_abc123...
```

SDK keys are obtained from the Applications settings in the dashboard.

## Endpoints

### Auth

#### POST /api/auth/register

Register a new user and tenant.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "tenantName": "Acme Corp"
}
```

**Response:** `201 Created`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "tenantId": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

#### POST /api/auth/login

Authenticate and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### GET /api/auth/me

Get current authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "tenantId": "uuid"
}
```

---

### Tickets

#### GET /api/tickets

List tickets with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status: `new`, `open`, `in_progress`, `resolved`, `closed` |
| `type` | string | Filter by type: `bug`, `feature`, `question`, `other` |
| `severity` | string | Filter by severity: `low`, `medium`, `high`, `critical` |
| `assignedTo` | uuid | Filter by assignee |
| `applicationId` | uuid | Filter by application |
| `search` | string | Search in title and description |
| `sortBy` | string | Sort field (default: `createdAt`) |
| `sortOrder` | string | `asc` or `desc` (default: `desc`) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Login button not working",
      "description": "When I click the login button...",
      "status": "new",
      "type": "bug",
      "severity": "high",
      "priority": 1,
      "aiSummary": "User unable to login due to...",
      "applicationId": "uuid",
      "reporterId": "uuid",
      "assignedTo": null,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### GET /api/tickets/:id

Get a single ticket with all details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Login button not working",
  "description": "When I click the login button...",
  "status": "new",
  "type": "bug",
  "typeConfidence": 0.95,
  "severity": "high",
  "severityConfidence": 0.87,
  "priority": 1,
  "reproductionSteps": [
    "Go to login page",
    "Enter credentials",
    "Click login button",
    "Nothing happens"
  ],
  "userContext": {
    "os": "Windows 11",
    "browser": "Chrome 120",
    "viewport": { "width": 1920, "height": 1080 },
    "url": "https://app.example.com/login"
  },
  "aiSummary": "User unable to login. The login button appears unresponsive...",
  "aiAnalysis": {
    "errorType": "UI interaction failure",
    "possibleCauses": ["JavaScript error", "Event handler not attached"],
    "suggestedFix": "Check browser console for errors"
  },
  "keywords": ["login", "button", "unresponsive"],
  "media": [
    {
      "id": "uuid",
      "type": "video",
      "storageUrl": "https://...",
      "durationMs": 15000,
      "processingStatus": "completed"
    }
  ],
  "application": {
    "id": "uuid",
    "name": "My Web App"
  },
  "reporter": {
    "id": "uuid",
    "name": "John Doe"
  },
  "assignee": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### POST /api/tickets

Create a new ticket (dashboard users).

**Request:**
```json
{
  "title": "Feature request: Dark mode",
  "description": "It would be great to have a dark mode option...",
  "applicationId": "uuid",
  "type": "feature",
  "severity": "low"
}
```

**Response:** `201 Created`

#### PATCH /api/tickets/:id

Update a ticket.

**Request:**
```json
{
  "status": "in_progress",
  "assignedTo": "uuid",
  "priority": 2
}
```

**Response:** `200 OK`

#### POST /api/tickets/:id/assign

Assign ticket to a user.

**Request:**
```json
{
  "userId": "uuid"
}
```

#### GET /api/tickets/search

Semantic search across tickets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `limit` | number | Max results (default: 10) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "...",
      "score": 0.95
    }
  ]
}
```

---

### Media

#### POST /api/media/upload-url

Request a pre-signed URL for direct S3 upload.

**Request:**
```json
{
  "ticketId": "uuid",
  "type": "video",
  "filename": "recording.webm",
  "contentType": "video/webm",
  "size": 5242880
}
```

**Response:** `200 OK`
```json
{
  "uploadUrl": "https://s3.../presigned-url",
  "mediaId": "uuid",
  "storageKey": "videos/uuid/recording.webm",
  "expiresAt": "2024-01-15T11:00:00Z"
}
```

#### POST /api/media/:id/confirm

Confirm upload completion and trigger processing.

**Response:** `200 OK`
```json
{
  "success": true,
  "processingStatus": "pending"
}
```

#### GET /api/media/:id

Get media details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "type": "video",
  "storageUrl": "https://...",
  "fileSize": 5242880,
  "mimeType": "video/webm",
  "durationMs": 15000,
  "processingStatus": "completed",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### GET /api/media/:id/download-url

Get a temporary download URL.

**Response:** `200 OK`
```json
{
  "downloadUrl": "https://s3.../presigned-download-url",
  "expiresAt": "2024-01-15T11:00:00Z"
}
```

---

### Applications

#### GET /api/applications

List all applications for the tenant.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Web App",
      "platform": "web",
      "sdkKey": "sk_live_abc123...",
      "githubRepo": "owner/repo",
      "settings": {},
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /api/applications

Create a new application.

**Request:**
```json
{
  "name": "My Web App",
  "platform": "web",
  "githubRepo": "owner/repo"
}
```

**Response:** `201 Created`

#### PATCH /api/applications/:id

Update an application.

#### DELETE /api/applications/:id

Delete an application.

#### POST /api/applications/:id/regenerate-key

Regenerate SDK key.

**Response:** `200 OK`
```json
{
  "sdkKey": "sk_live_new_key..."
}
```

---

### Users

#### GET /api/users

List users in tenant.

#### GET /api/users/:id

Get user details.

#### PATCH /api/users/:id

Update user.

#### DELETE /api/users/:id

Remove user from tenant.

---

### GitHub

#### GET /api/github/repos

List connected GitHub repositories.

#### POST /api/github/connect

Initiate GitHub OAuth flow.

#### POST /api/github/issues

Create GitHub issue from ticket.

**Request:**
```json
{
  "ticketId": "uuid",
  "repo": "owner/repo",
  "title": "Bug: Login button not working",
  "body": "...",
  "labels": ["bug", "high-priority"]
}
```

#### GET /api/github/issues/:ticketId

Get linked GitHub issues for a ticket.

---

### SDK Endpoints

These endpoints use SDK key authentication (`x-sdk-key` header).

#### POST /api/sdk/tickets

Create a ticket from SDK.

**Headers:** `x-sdk-key: sk_live_...`

**Request:**
```json
{
  "title": "Bug report",
  "description": "Something went wrong...",
  "userContext": {
    "os": "Windows 11",
    "browser": "Chrome 120",
    "viewport": { "width": 1920, "height": 1080 },
    "url": "https://app.example.com/dashboard"
  },
  "sessionId": "session_abc123"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "status": "new"
}
```

#### POST /api/sdk/media/upload-url

Request upload URL for SDK uploads.

**Headers:** `x-sdk-key: sk_live_...`

**Request:**
```json
{
  "ticketId": "uuid",
  "type": "video",
  "filename": "recording.webm",
  "contentType": "video/webm",
  "size": 5242880
}
```

#### POST /api/sdk/media/:id/confirm

Confirm SDK upload.

**Headers:** `x-sdk-key: sk_live_...`

---

## Error Handling

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Missing/invalid auth |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation error |
| `429` | Too Many Requests - Rate limited |
| `500` | Internal Server Error |

### Common Errors

**Invalid JWT:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

**Invalid SDK Key:**
```json
{
  "statusCode": 401,
  "message": "Invalid SDK key",
  "error": "Unauthorized"
}
```

**Resource Not Found:**
```json
{
  "statusCode": 404,
  "message": "Ticket not found",
  "error": "Not Found"
}
```

---

## Rate Limiting

Rate limits are applied per IP and per API key.

### Limits

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 10 requests/minute |
| SDK endpoints | 100 requests/minute |
| General API | 200 requests/minute |
| File uploads | 20 requests/minute |

### Headers

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1705315800
```

### Rate Limit Exceeded

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "error": "Too Many Requests"
}
```

---

## Webhooks

Configure webhooks to receive real-time notifications.

### Events

| Event | Description |
|-------|-------------|
| `ticket.created` | New ticket created |
| `ticket.updated` | Ticket updated |
| `ticket.assigned` | Ticket assigned |
| `ticket.resolved` | Ticket resolved |
| `media.processed` | Video processing complete |

### Payload Format

```json
{
  "event": "ticket.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "ticket": { ... }
  },
  "signature": "sha256=..."
}
```

### Verifying Signatures

```typescript
import crypto from 'crypto';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expected}` === signature;
}
```

---

## OpenAPI Specification

The full OpenAPI 3.0 specification is available at:
- **JSON**: `/api/docs-json`
- **YAML**: `/api/docs-yaml`
- **Swagger UI**: `/api/docs`

Export for use with API clients:
```bash
curl http://localhost:3001/api/docs-json > openapi.json
```

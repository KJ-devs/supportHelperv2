# GitHub Integration Module

Complete GitHub integration for the Support Helper platform.

## Features

- **OAuth Flow**: Secure GitHub authentication with CSRF protection
- **Repository Management**: List and link repositories to applications
- **Issue Creation**: Create GitHub issues from tickets with rich templates
- **Related Issues Search**: Find similar issues in repositories
- **Bidirectional Sync**: Webhooks for automatic ticket ↔ issue synchronization
- **Async Processing**: BullMQ queue for webhook event processing

## Endpoints

### OAuth Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/github/oauth/authorize` | Start OAuth flow, get authorization URL |
| GET | `/github/oauth/callback` | OAuth callback (called by GitHub) |
| GET | `/github/oauth/status` | Check connection status |
| DELETE | `/github/oauth/disconnect` | Disconnect GitHub integration |

### Repository Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/github/repos` | List user repositories |
| GET | `/github/repos/connected` | List connected repositories |
| GET | `/github/repos/:owner/:repo` | Get repository details |
| POST | `/github/repos/link` | Link repository to application |
| DELETE | `/github/repos/link/:appId` | Unlink repository from application |

### Ticket Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets/:id/github/create-issue` | Create GitHub issue from ticket |
| GET | `/tickets/:id/github/issues` | Get linked GitHub issues |
| GET | `/tickets/:id/github/related` | Search for related issues |
| POST | `/tickets/:id/github/sync` | Sync ticket to GitHub issues |
| DELETE | `/tickets/:id/github/issues/:issueId` | Unlink GitHub issue |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/github/webhooks` | Handle GitHub webhook events |

## Environment Variables

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

## Supported Webhook Events

- `issues` - Issue opened, closed, reopened, labeled, etc.
- `pull_request` - PR events with ticket reference detection
- `push` - Commit events with ticket reference detection
- `issue_comment` - Comments on issues

## Architecture

```
github/
├── controllers/
│   ├── github-oauth.controller.ts    # OAuth flow endpoints
│   ├── github-repos.controller.ts    # Repository management
│   ├── github-webhooks.controller.ts # Webhook handling
│   └── ticket-github.controller.ts   # Ticket-GitHub integration
├── services/
│   ├── github-oauth.service.ts       # OAuth & authentication
│   ├── github-repos.service.ts       # Repository operations
│   ├── github-issues.service.ts      # Issue management
│   └── github-webhooks.service.ts    # Webhook processing
├── processors/
│   └── github-webhook.processor.ts   # BullMQ webhook processor
├── dto/
│   ├── github-oauth.dto.ts           # OAuth DTOs
│   ├── github-repos.dto.ts           # Repository DTOs
│   └── github-issues.dto.ts          # Issue DTOs
└── github.module.ts                  # Module definition
```

## Issue Template

When creating an issue from a ticket, the following template is used:

```markdown
## Description

{ticket description}

## AI Analysis

{AI summary if available}

## Reproduction Steps

1. Step 1
2. Step 2
...

## User Context

- **OS**: {os}
- **Browser**: {browser}
- **Version**: {version}

## Media

- [View Recording](link)

---

**Ticket ID**: `abc123` | **Type**: bug | **Severity**: high | **Status**: open

*Created from Support Helper*
```

## Auto Labels

Issues are automatically labeled with:
- `support` - Always added
- `type:{ticket_type}` - e.g., `type:bug`, `type:feature`
- `severity:{severity}` - e.g., `severity:critical`, `severity:high`

## Bidirectional Sync

When a GitHub issue is:
- **Closed** → Ticket status changes to `resolved`
- **Reopened** → Ticket status changes to `open`
- **Labeled** → Ticket type/severity updated if matching labels

When a ticket is:
- **Resolved** → Linked GitHub issues are closed
- **Reopened** → Linked GitHub issues are reopened

## Dependencies

- `@octokit/rest@21.x` - GitHub API client
- `@octokit/webhooks@12.x` - Webhook signature verification
- `@nestjs/bullmq` - Async job processing

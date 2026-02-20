import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Prisma
import { PrismaModule } from '../../prisma/prisma.module';

// AI
import { AIModule } from '../../ai/ai.module';

// Codebase Indexing
import { CodebaseIndexModule } from '../codebase-index/codebase-index.module';

// Agent Tasks (CI feedback loop)
import { AgentTasksModule } from '../agent-tasks/agent-tasks.module';

// Tickets (timeline events for auto-merge)
import { TicketsModule } from '../tickets/tickets.module';

// Services
import {
  GithubOAuthService,
  GithubReposService,
  GithubIssuesService,
  GithubWebhooksService,
  GithubUserstoryService,
  GithubAppService,
  GithubInstallationService,
  ProjectGithubConfigService,
  TemplateRendererService,
} from './services';

// Controllers
import {
  GithubOAuthController,
  GithubReposController,
  GithubWebhooksController,
  TicketGithubController,
  GithubAppController,
  GithubInstallationController,
  ProjectGithubController,
} from './controllers';

// Processors
import { GithubWebhookProcessor } from './processors';

/**
 * GitHub Integration Module
 *
 * Features:
 * - OAuth flow for GitHub authentication
 * - Repository listing and linking
 * - Issue creation from tickets
 * - Related issues search
 * - Webhook handling for bidirectional sync
 *
 * Endpoints:
 * - GET  /github/oauth/authorize     - Start OAuth flow
 * - GET  /github/oauth/callback      - OAuth callback
 * - GET  /github/oauth/status        - Connection status
 * - DELETE /github/oauth/disconnect  - Disconnect GitHub
 *
 * - POST /github/repos               - List user repos
 * - GET  /github/repos/connected     - Connected repos
 * - POST /github/repos/link          - Link repo to app
 *
 * - POST /tickets/:id/github/create-issue - Create issue
 * - GET  /tickets/:id/github/related      - Find related issues
 * - GET  /tickets/:id/github/issues       - Get linked issues
 * - POST /tickets/:id/github/sync         - Sync to GitHub
 * - POST /tickets/:id/github/user-story   - Create User Story
 *
 * - POST /github/webhooks            - Webhook handler
 */
@Module({
  imports: [
    PrismaModule,
    AIModule,
    forwardRef(() => CodebaseIndexModule),
    forwardRef(() => AgentTasksModule),
    forwardRef(() => TicketsModule),
    // Register BullMQ queue for async webhook processing
    BullModule.registerQueue({
      name: 'github',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    // Codebase indexing queue for per-file reindex on push events (US-5.2)
    BullModule.registerQueue({
      name: 'codebase-indexing',
    }),
  ],
  controllers: [
    // New modular controllers
    GithubOAuthController,
    GithubReposController,
    GithubWebhooksController,
    TicketGithubController,
    GithubAppController,
    GithubInstallationController,
    ProjectGithubController,
  ],
  providers: [
    // New modular services
    GithubOAuthService,
    GithubReposService,
    GithubIssuesService,
    GithubWebhooksService,
    GithubUserstoryService,
    GithubAppService,
    GithubInstallationService,
    ProjectGithubConfigService,
    TemplateRendererService,
    // BullMQ processor
    GithubWebhookProcessor,
  ],
  exports: [
    GithubOAuthService,
    GithubReposService,
    GithubIssuesService,
    GithubWebhooksService,
    GithubUserstoryService,
    GithubAppService,
    GithubInstallationService,
    ProjectGithubConfigService,
    TemplateRendererService,
  ],
})
export class GithubModule {}

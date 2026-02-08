import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Prisma
import { PrismaModule } from '../../prisma/prisma.module';

// Services
import {
  GithubOAuthService,
  GithubReposService,
  GithubIssuesService,
  GithubWebhooksService,
} from './services';

// Controllers
import {
  GithubOAuthController,
  GithubReposController,
  GithubWebhooksController,
  TicketGithubController,
} from './controllers';

// Processors
import { GithubWebhookProcessor } from './processors';

// Legacy - keep for backward compatibility
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { GithubWebhookController } from './github-webhook.controller';

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
 *
 * - POST /github/webhooks            - Webhook handler
 */
@Module({
  imports: [
    PrismaModule,
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
  ],
  controllers: [
    // New modular controllers
    GithubOAuthController,
    GithubReposController,
    GithubWebhooksController,
    TicketGithubController,
    // Legacy controllers (for backward compatibility)
    GithubController,
    GithubWebhookController,
  ],
  providers: [
    // New modular services
    GithubOAuthService,
    GithubReposService,
    GithubIssuesService,
    GithubWebhooksService,
    // BullMQ processor
    GithubWebhookProcessor,
    // Legacy service (for backward compatibility)
    GithubService,
  ],
  exports: [
    GithubOAuthService,
    GithubReposService,
    GithubIssuesService,
    GithubWebhooksService,
    GithubService,
  ],
})
export class GithubModule {}

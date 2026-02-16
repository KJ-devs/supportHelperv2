import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { CodebaseIndexModule } from '../codebase-index/codebase-index.module';
import { GithubModule } from '../github/github.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentTasksService } from './agent-tasks.service';
import { AgentTasksController } from './agent-tasks.controller';
import { CodeAnalysisAgentService } from './services/code-analysis-agent.service';
import { CodeGenerationAgentService } from './services/code-generation-agent.service';
import { CIFeedbackService } from './services/ci-feedback.service';
import { ValidationModeService } from './services/validation-mode.service';
import { ReviewExpiryScheduler, ReviewExpiryProcessor } from './services/review-expiry.service';

@Module({
  imports: [
    PrismaModule,
    AiConfigModule,
    BullModule.registerQueue(
      { name: 'agent-orchestration' },
      { name: 'review-expiry' },
    ),
    forwardRef(() => CodebaseIndexModule),
    forwardRef(() => GithubModule),
    forwardRef(() => TicketsModule),
  ],
  controllers: [AgentTasksController],
  providers: [
    AgentTasksService,
    CodeAnalysisAgentService,
    CodeGenerationAgentService,
    CIFeedbackService,
    ValidationModeService,
    ReviewExpiryScheduler,
    ReviewExpiryProcessor,
  ],
  exports: [
    AgentTasksService,
    CodeAnalysisAgentService,
    CodeGenerationAgentService,
    CIFeedbackService,
    ValidationModeService,
  ],
})
export class AgentTasksModule {}

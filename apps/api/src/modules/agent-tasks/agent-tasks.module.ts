import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { AuthModule } from '../../auth/auth.module';
import { CodebaseIndexModule } from '../codebase-index/codebase-index.module';
import { GithubModule } from '../github/github.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AgentV2Module } from '../agent-v2/agent-v2.module';
import { AgentTasksService } from './agent-tasks.service';
import { AgentTasksController } from './agent-tasks.controller';
import { CodeAnalysisAgentService } from './services/code-analysis-agent.service';
import { CodeGenerationAgentService } from './services/code-generation-agent.service';
import { CIFeedbackService } from './services/ci-feedback.service';
import { ValidationModeService } from './services/validation-mode.service';
import { ReviewExpiryScheduler, ReviewExpiryProcessor } from './services/review-expiry.service';
import { AgentTasksGateway } from './agent-tasks.gateway';

@Module({
  imports: [
    PrismaModule,
    AiConfigModule,
    AuthModule,
    BullModule.registerQueue(
      { name: 'agent-orchestration' },
      { name: 'review-expiry' },
    ),
    forwardRef(() => CodebaseIndexModule),
    forwardRef(() => GithubModule),
    forwardRef(() => TicketsModule),
    forwardRef(() => AgentV2Module),
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
    AgentTasksGateway,
  ],
  exports: [
    AgentTasksService,
    CodeAnalysisAgentService,
    CodeGenerationAgentService,
    CIFeedbackService,
    ValidationModeService,
    AgentTasksGateway,
  ],
})
export class AgentTasksModule {}

import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { CodebaseIndexModule } from '../codebase-index/codebase-index.module';
import { GithubModule } from '../github/github.module';
import { AgentTasksService } from './agent-tasks.service';
import { AgentTasksController } from './agent-tasks.controller';
import { CodeAnalysisAgentService } from './services/code-analysis-agent.service';
import { CodeGenerationAgentService } from './services/code-generation-agent.service';

@Module({
  imports: [
    PrismaModule,
    AiConfigModule,
    BullModule.registerQueue({ name: 'agent-orchestration' }),
    forwardRef(() => CodebaseIndexModule),
    forwardRef(() => GithubModule),
  ],
  controllers: [AgentTasksController],
  providers: [AgentTasksService, CodeAnalysisAgentService, CodeGenerationAgentService],
  exports: [AgentTasksService, CodeAnalysisAgentService, CodeGenerationAgentService],
})
export class AgentTasksModule {}

import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisCacheModule } from '../../cache/cache.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { GithubModule } from '../github/github.module';
import { CodebaseIndexModule } from '../codebase-index/codebase-index.module';
import { AuthModule } from '../../auth/auth.module';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { TicketsModule } from '../tickets/tickets.module';

import { CodeInvestigationService } from './code-investigation.service';
import { ToolExecutorService } from './tool-executor.service';
import { AgenticLoopService } from './agentic-loop.service';
import { DiagnosisService } from './diagnosis.service';
import { DeepAnalysisService } from './deep-analysis.service';
import { AgentV2Controller } from './agent-v2.controller';
import { AgentV2Gateway } from './agent-v2.gateway';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    RedisCacheModule,
    AiConfigModule,
    AuthModule,
    forwardRef(() => GithubModule),
    forwardRef(() => CodebaseIndexModule),
    forwardRef(() => TicketsModule),
    BullModule.registerQueue({
      name: 'deep-analysis',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [AgentV2Controller],
  providers: [
    InternalAuthGuard,
    CodeInvestigationService,
    ToolExecutorService,
    AgenticLoopService,
    DiagnosisService,
    DeepAnalysisService,
    AgentV2Gateway,
    WsJwtGuard,
  ],
  exports: [DeepAnalysisService, DiagnosisService, CodeInvestigationService],
})
export class AgentV2Module {}

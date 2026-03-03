import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TriageService } from './triage.service';
import { TriageClassificationService } from './triage-classification.service';
import { TriageRouterService } from './triage-router.service';
import { TriageController } from './triage.controller';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    forwardRef(() => TicketsModule),
    BullModule.registerQueue({
      name: 'triage',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    BullModule.registerQueue({ name: 'n1-triage' }),
    BullModule.registerQueue({ name: 'agent-orchestration' }),
  ],
  controllers: [TriageController],
  providers: [
    TriageService,
    TriageClassificationService,
    TriageRouterService,
  ],
  exports: [TriageService],
})
export class TriageModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { AuthModule } from '../../auth/auth.module';
import { TicketRelationsModule } from '../ticket-relations/ticket-relations.module';
import { N1TriageService } from './n1-triage.service';
import { N1TriageController } from './n1-triage.controller';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    AiConfigModule,
    AuthModule,
    TicketRelationsModule,
    BullModule.registerQueue({ name: 'deep-analysis' }),
  ],
  controllers: [N1TriageController],
  providers: [N1TriageService, InternalAuthGuard],
  exports: [N1TriageService],
})
export class N1TriageModule {}

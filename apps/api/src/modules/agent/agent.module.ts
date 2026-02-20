import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AgentGateway } from './agent.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { AuthModule } from '../../auth/auth.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    AuthModule,
    forwardRef(() => TicketsModule),
    forwardRef(() => NotificationModule),
    BullModule.registerQueue({
      name: 'agent-orchestration',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway, WsJwtGuard],
  exports: [AgentService],
})
export class AgentModule {}

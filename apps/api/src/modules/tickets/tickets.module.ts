import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TicketsService } from './tickets.service';
import { TicketsSearchService } from './tickets-search.service';
import { TicketsAIService } from './tickets-ai.service';
import { TicketTimelineService } from './services/ticket-timeline.service';
import { TicketsGateway } from './tickets.gateway';
import { TicketsController } from './tickets.controller';
import { SdkTicketsController } from './sdk-tickets.controller';
import { TicketTrackingController } from './ticket-tracking.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { AuthModule } from '../../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationModule } from '../notifications/notification.module';
import { WsJwtGuard } from '../agent/ws-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    AIModule,
    AuthModule,
    IntegrationsModule,
    forwardRef(() => NotificationModule),
    BullModule.registerQueue({
      name: 'ticket-analysis',
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
    // GitHub queue for auto-issue creation on ticket create
    BullModule.registerQueue({
      name: 'github',
    }),
  ],
  controllers: [TicketsController, SdkTicketsController, TicketTrackingController],
  providers: [TicketsService, TicketsSearchService, TicketsAIService, TicketTimelineService, TicketsGateway, WsJwtGuard],
  exports: [TicketsService, TicketsSearchService, TicketsAIService, TicketTimelineService, TicketsGateway],
})
export class TicketsModule {}

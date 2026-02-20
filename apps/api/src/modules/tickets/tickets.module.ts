import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TicketsService } from './tickets.service';
import { TicketsSearchService } from './tickets-search.service';
import { TicketsAIService } from './tickets-ai.service';
import { TicketTimelineService } from './services/ticket-timeline.service';
import { ResolutionSummaryService } from './services/resolution-summary.service';
import { AutoResponseService } from './services/auto-response.service';
import { TicketsGateway } from './tickets.gateway';
import { TicketsController } from './tickets.controller';
import { SdkTicketsController } from './sdk-tickets.controller';
import { TicketTrackingController } from './ticket-tracking.controller';
import { TicketReopenController } from './controllers/ticket-reopen.controller';
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
    // Deep analysis queue (US-3.2)
    BullModule.registerQueue({
      name: 'deep-analysis',
    }),
  ],
  controllers: [TicketsController, SdkTicketsController, TicketTrackingController, TicketReopenController],
  providers: [TicketsService, TicketsSearchService, TicketsAIService, TicketTimelineService, ResolutionSummaryService, AutoResponseService, TicketsGateway, WsJwtGuard],
  exports: [TicketsService, TicketsSearchService, TicketsAIService, TicketTimelineService, ResolutionSummaryService, AutoResponseService, TicketsGateway],
})
export class TicketsModule {}

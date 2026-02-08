import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsCryptoService } from './integrations-crypto.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { SlackProvider, DiscordProvider, NotionProvider } from './providers';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'integration-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400,
          count: 1000,
        },
        removeOnFail: {
          age: 604800,
        },
      },
    }),
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsCryptoService,
    IntegrationsSyncService,
    SlackProvider,
    DiscordProvider,
    NotionProvider,
  ],
  exports: [IntegrationsService, IntegrationsSyncService],
})
export class IntegrationsModule {}

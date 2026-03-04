import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { TicketRelationsService } from './ticket-relations.service';
import { TicketRelationsController } from './ticket-relations.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TicketRelationsController],
  providers: [TicketRelationsService],
  exports: [TicketRelationsService],
})
export class TicketRelationsModule {}

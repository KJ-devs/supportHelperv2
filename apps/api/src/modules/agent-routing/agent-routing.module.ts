import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentRoutingService } from './agent-routing.service';

@Module({
  imports: [PrismaModule],
  providers: [AgentRoutingService],
  exports: [AgentRoutingService],
})
export class AgentRoutingModule {}

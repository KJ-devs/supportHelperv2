import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AgentGateway } from './agent.gateway';
import { WsJwtGuard } from './ws-jwt.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIModule } from '../../ai/ai.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AIModule, AuthModule],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway, WsJwtGuard],
  exports: [AgentService],
})
export class AgentModule {}

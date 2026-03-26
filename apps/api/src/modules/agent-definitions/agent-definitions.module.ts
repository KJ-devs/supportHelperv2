import { Module } from '@nestjs/common';
import { AgentDefinitionsController } from './agent-definitions.controller';
import { AgentDefinitionsService } from './agent-definitions.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgentDefinitionsController],
  providers: [AgentDefinitionsService],
  exports: [AgentDefinitionsService],
})
export class AgentDefinitionsModule {}

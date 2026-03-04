import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AgentModule],
  controllers: [AdminController],
})
export class AdminModule {}

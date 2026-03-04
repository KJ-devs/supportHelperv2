import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { QueueMonitorService } from './queue-monitor.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'agent-orchestration' },
      { name: 'triage' },
      { name: 'deep-analysis' },
      { name: 'video-analysis' },
      { name: 'github-sync' },
      { name: 'integration-sync' },
    ),
  ],
  controllers: [AdminController],
  providers: [QueueMonitorService],
})
export class AdminModule {}

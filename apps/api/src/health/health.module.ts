import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { StartupCheckService } from '../common/services/startup-check.service';

@Module({
  imports: [MonitoringModule],
  controllers: [HealthController],
  providers: [StartupCheckService],
})
export class HealthModule {}

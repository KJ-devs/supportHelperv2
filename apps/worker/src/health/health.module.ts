import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { StartupCheckService } from '../services/startup-check.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [HealthController],
  providers: [StartupCheckService],
})
export class HealthModule {}

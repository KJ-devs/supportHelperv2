import { Module, Global } from '@nestjs/common';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseFeatureGuard } from './guards/license-feature.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [LicenseController],
  providers: [LicenseService, LicenseFeatureGuard],
  exports: [LicenseService, LicenseFeatureGuard],
})
export class LicenseModule {}

import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { SetupAccessGuard } from './setup-access.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SetupController],
  providers: [SetupService, SetupAccessGuard],
  exports: [SetupService],
})
export class SetupModule {}

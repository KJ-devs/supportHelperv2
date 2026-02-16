import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LicenseModule } from '../license/license.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Audit Module
 *
 * @Global - AuditService is available for injection across the app
 * Feature-gated: requires 'audit_logs' feature (Pro/Enterprise plans)
 */
@Global()
@Module({
  imports: [PrismaModule, LicenseModule],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}

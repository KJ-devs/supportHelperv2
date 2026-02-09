import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TenantGuard ensures that authenticated users can only access resources
 * belonging to their tenant. It also sets up the tenant context for RLS.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // For SDK key auth, tenant comes from the application
    const tenantId = user.tenantId || user.tenant?.id;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context not found');
    }

    // Set tenant context for the request
    request.tenantId = tenantId;

    // Set PostgreSQL session variable for RLS
    // This enables Row Level Security policies to filter by tenant
    await this.prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;

    return true;
  }
}

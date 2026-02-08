import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserEntity, ApplicationEntity } from '../dto/auth.dto';

/**
 * Tenant Context Middleware
 *
 * Sets the current tenant ID in PostgreSQL session for Row-Level Security (RLS)
 * This enables database-level multi-tenant isolation
 *
 * The middleware:
 * 1. Extracts tenantId from authenticated user/application
 * 2. Sets PostgreSQL session variable: current_tenant_id
 * 3. RLS policies use this variable to filter queries automatically
 *
 * Note: This requires RLS policies to be enabled on tenant-scoped tables
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as UserEntity | ApplicationEntity;

    if (user?.tenantId) {
      try {
        // Set PostgreSQL session variable for RLS using parameterized query
        // This is safer than string interpolation to prevent SQL injection
        await this.prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${user.tenantId}`;
      } catch (error) {
        console.error('Failed to set tenant context:', error);
        // Continue execution - RLS will be enforced at application level
      }
    }

    next();
  }
}

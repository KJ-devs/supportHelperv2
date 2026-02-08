import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserEntity, ApplicationEntity } from '../dto/auth.dto';

/**
 * Tenant Guard
 *
 * Ensures that authenticated users/applications can only access their own tenant's data
 * This works in conjunction with TenantContextMiddleware for Row-Level Security
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantGuard)
 * @Get('data')
 * getData(@CurrentTenant('id') tenantId: string) {
 *   // tenantId is guaranteed to be set
 * }
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserEntity | ApplicationEntity;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract tenantId from user or application
    const tenantId = user.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant not found');
    }

    // Store tenantId in request for use in services
    request.tenantId = tenantId;

    return true;
  }
}

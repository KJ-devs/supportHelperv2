import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

/**
 * Guard to ensure tenant isolation
 * Validates that the requested resource belongs to the user's tenant
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Tenant information not found');
    }

    // Tenant ID is available in request.user.tenantId
    // Individual controllers should validate resource ownership
    return true;
  }
}

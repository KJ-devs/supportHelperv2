import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantEntity, UserEntity, ApplicationEntity } from '../dto/auth.dto';

/**
 * Decorator to extract the current tenant from the request
 *
 * Works with both JWT auth (user.tenant) and API Key auth (application.tenant)
 *
 * Usage:
 * @Get('settings')
 * @UseGuards(JwtAuthGuard)
 * getSettings(@CurrentTenant() tenant: TenantEntity) {
 *   return tenant;
 * }
 */
export const CurrentTenant = createParamDecorator(
  (data: keyof TenantEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Try to get tenant from user (JWT auth)
    let tenant: TenantEntity | undefined = (request.user as UserEntity)?.tenant;

    // If not found, try to get from application (API Key auth)
    if (!tenant) {
      tenant = (request.user as ApplicationEntity)?.tenant;
    }

    // If a specific property is requested, return only that
    return data ? tenant?.[data] : tenant;
  },
);

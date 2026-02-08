import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current tenant ID from authenticated user
 * @example
 * async getData(@CurrentTenant() tenantId: string) {
 *   return this.service.findByTenant(tenantId);
 * }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);

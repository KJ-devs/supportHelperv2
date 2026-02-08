import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Tenant } from '@prisma/client';

export const CurrentTenant = createParamDecorator(
  (data: keyof Tenant | undefined, ctx: ExecutionContext): Tenant | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    const tenant = user?.tenant as Tenant;

    return data ? tenant?.[data] : tenant;
  }
);

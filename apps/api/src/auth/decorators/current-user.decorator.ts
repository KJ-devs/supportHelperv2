import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User, Tenant } from '@prisma/client';

export type CurrentUserType = User & { tenant: Tenant };

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserType | undefined, ctx: ExecutionContext): CurrentUserType | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserType;

    return data ? user?.[data] : user;
  }
);

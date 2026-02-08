import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../dto/auth.dto';

/**
 * Decorator to extract the current authenticated user from the request
 *
 * Usage in JWT-protected routes:
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: UserEntity) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserEntity;

    // If a specific property is requested, return only that
    return data ? user?.[data] : user;
  },
);

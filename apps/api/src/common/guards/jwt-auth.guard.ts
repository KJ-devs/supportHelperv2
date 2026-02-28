import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SDK_ROUTE_KEY } from '../decorators/sdk-auth.decorator';
import { IS_INTERNAL_ROUTE_KEY } from '../decorators/internal-route.decorator';

/**
 * Global JWT authentication guard
 * Skips authentication for routes marked with @Public(), @SdkAuth(), or @InternalRoute()
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Check if route uses SDK authentication
    const isSdkRoute = this.reflector.getAllAndOverride<boolean>(
      IS_SDK_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isSdkRoute) {
      return true;
    }

    // Check if route uses internal service-to-service authentication
    // (handled by InternalAuthGuard instead)
    const isInternalRoute = this.reflector.getAllAndOverride<boolean>(
      IS_INTERNAL_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isInternalRoute) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}

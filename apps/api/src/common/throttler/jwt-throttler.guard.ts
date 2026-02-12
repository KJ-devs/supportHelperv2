import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * JWT Throttler Guard
 *
 * Rate limits authenticated endpoints based on user ID
 * - 100 requests per minute per user
 * - Uses 'authenticated' throttler configuration
 */
@Injectable()
export class JwtThrottlerGuard extends ThrottlerGuard {
  /**
   * Get tracking key from authenticated user
   */
  protected async getTracker(req: Request): Promise<string> {
    // Extract user from request (set by JWT strategy)
    const user = (req as any).user;

    // If user exists, use user ID as tracker
    if (user?.userId) {
      return `user:${user.userId}`;
    }

    // Fallback to IP address
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Get throttler context name
   */
  protected getThrottlerName(context: ExecutionContext): string {
    return 'authenticated';
  }
}

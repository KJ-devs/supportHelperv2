import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Public Throttler Guard
 *
 * Rate limits public endpoints based on IP address
 * - 10 requests per minute per IP
 * - Uses 'public' throttler configuration
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  /**
   * Get tracking key from IP address
   */
  protected async getTracker(req: Request): Promise<string> {
    // Use IP address as tracker
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Get throttler context name
   */
  protected getThrottlerName(context: ExecutionContext): string {
    return 'public';
  }
}

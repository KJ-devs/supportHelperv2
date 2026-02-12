import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * SDK Key Throttler Guard
 *
 * Rate limits SDK endpoints based on SDK key
 * - 50 requests per minute per SDK key
 * - Uses 'sdk' throttler configuration
 */
@Injectable()
export class SdkThrottlerGuard extends ThrottlerGuard {
  /**
   * Get tracking key from SDK key header
   */
  protected async getTracker(req: Request): Promise<string> {
    // Extract SDK key from header
    const sdkKey = req.headers['x-sdk-key'] as string;

    // If SDK key exists, use it as tracker
    if (sdkKey) {
      return `sdk:${sdkKey}`;
    }

    // Fallback to IP address
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Get throttler context name
   */
  protected getThrottlerName(context: ExecutionContext): string {
    return 'sdk';
  }
}

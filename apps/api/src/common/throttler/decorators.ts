import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SdkThrottlerGuard } from './sdk-throttler.guard';
import { JwtThrottlerGuard } from './jwt-throttler.guard';
import { PublicThrottlerGuard } from './public-throttler.guard';

/**
 * Apply public rate limiting
 * 10 requests per minute per IP
 */
export function PublicRateLimit() {
  return applyDecorators(
    Throttle({ public: { limit: 10, ttl: 60000 } }),
    UseGuards(PublicThrottlerGuard),
  );
}

/**
 * Apply authenticated rate limiting
 * 100 requests per minute per user
 */
export function AuthenticatedRateLimit() {
  return applyDecorators(
    Throttle({ authenticated: { limit: 100, ttl: 60000 } }),
    UseGuards(JwtThrottlerGuard),
  );
}

/**
 * Apply SDK rate limiting
 * 50 requests per minute per SDK key
 */
export function SdkRateLimit() {
  return applyDecorators(
    Throttle({ sdk: { limit: 50, ttl: 60000 } }),
    UseGuards(SdkThrottlerGuard),
  );
}

/**
 * Skip rate limiting for a route
 */
export function SkipThrottle() {
  return Throttle({ default: { limit: 0, ttl: 0 } });
}

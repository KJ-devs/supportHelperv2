import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

/**
 * IP Whitelist Guard
 *
 * Bypasses rate limiting for whitelisted IP addresses.
 * Configured via RATE_LIMIT_WHITELIST env var (comma-separated).
 *
 * Usage: Combine with ThrottlerGuard
 * @UseGuards(IpWhitelistGuard, ThrottlerGuard)
 *
 * Default whitelist (for development):
 * - 127.0.0.1 (IPv4 localhost)
 * - ::1 (IPv6 localhost)
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);
  private readonly whitelist: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const whitelistEnv = this.configService.get<string>('RATE_LIMIT_WHITELIST', '');
    const whitelistArray = whitelistEnv
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    this.whitelist = new Set(whitelistArray);

    if (this.whitelist.size > 0) {
      this.logger.log(`IP whitelist configured: ${Array.from(this.whitelist).join(', ')}`);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { __rateLimit_bypassed?: boolean }>();
    const clientIp = this.getClientIp(request);

    if (this.whitelist.has(clientIp)) {
      this.logger.debug(`Rate limiting bypassed for whitelisted IP: ${clientIp}`);
      // Mark request as whitelisted to skip throttler
      request.__rateLimit_bypassed = true;
      return true;
    }

    return true; // Always pass - this guard only marks bypass, doesn't block
  }

  /**
   * Extract client IP from request
   * Handles proxies via X-Forwarded-For header
   */
  private getClientIp(request: Request & { connection?: { remoteAddress?: string } }): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can be comma-separated list, take first
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.connection.remoteAddress || '';
  }
}

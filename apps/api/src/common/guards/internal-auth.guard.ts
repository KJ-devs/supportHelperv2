import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * InternalAuthGuard
 *
 * Protects internal service-to-service endpoints (e.g., worker → API).
 * Requires BOTH:
 *   1. A valid `x-internal-secret` header matching INTERNAL_API_SECRET
 *   2. A valid JWT in the `Authorization: Bearer <token>` header, signed
 *      with JWT_SECRET (the worker uses a service-account JWT — no DB lookup)
 *
 * This dual-factor approach ensures that even if one credential leaks, the
 * endpoint remains protected by the second factor.
 *
 * Usage:
 *   @UseGuards(InternalAuthGuard)
 *   @ApiExcludeEndpoint()
 *   async internalEndpoint(...) { ... }
 *
 * Do NOT combine with @Public() — this guard IS the access control.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // ── Step 1: Validate x-internal-secret header ──────────────────────────
    const providedSecret = request.headers['x-internal-secret'] as string | undefined;
    const expectedSecret = this.configService.get<string>('INTERNAL_API_SECRET');

    if (!expectedSecret) {
      this.logger.error('INTERNAL_API_SECRET is not configured — rejecting all internal requests');
      throw new UnauthorizedException('Internal service not configured');
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      this.logger.warn('Internal request rejected: invalid or missing x-internal-secret header');
      throw new UnauthorizedException('Invalid internal secret');
    }

    // ── Step 2: Validate JWT from Authorization header ──────────────────────
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Internal request rejected: missing or malformed Authorization header');
      throw new UnauthorizedException('Missing service account token');
    }

    const token = authHeader.slice('Bearer '.length);

    // Prefer WORKER_JWT_SECRET (dedicated worker key); fall back to JWT_SECRET
    const workerJwtSecret = this.configService.get<string>('WORKER_JWT_SECRET');
    const jwtSecret = workerJwtSecret || this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      this.logger.error('Neither WORKER_JWT_SECRET nor JWT_SECRET is configured');
      throw new UnauthorizedException('JWT configuration error');
    }

    try {
      this.jwtService.verify(token, { secret: jwtSecret });
    } catch {
      // If using WORKER_JWT_SECRET and it fails, don't try JWT_SECRET as fallback
      // to avoid weakening the separation
      this.logger.warn('Internal request rejected: JWT verification failed');
      throw new UnauthorizedException('Invalid service account token');
    }

    return true;
  }
}

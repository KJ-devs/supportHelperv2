import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../dto/auth.dto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
    }
  }
}

/**
 * TenantContextMiddleware extracts tenant information from JWT or SDK key
 * and sets the PostgreSQL session variable for Row Level Security (RLS)
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let userId: string | undefined;

    // Try JWT token first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        tenantId = payload.tenantId;
        userId = payload.sub;
      } catch {
        // Token invalid or expired, continue to try SDK key
      }
    }

    // Try SDK key if no JWT
    if (!tenantId) {
      const sdkKey = req.headers['x-sdk-key'] as string;
      if (sdkKey) {
        const application = await this.prisma.application.findUnique({
          where: { sdkKey },
          select: { tenantId: true },
        });
        if (application) {
          tenantId = application.tenantId;
        }
      }
    }

    // Set context on request
    if (tenantId) {
      req.tenantId = tenantId;
      req.userId = userId;

      // Set PostgreSQL session variable for RLS
      // Note: SET LOCAL doesn't support parameterized queries ($1),
      // so we validate UUID format before using $executeRawUnsafe
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(tenantId)) {
        try {
          await this.prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        } catch {
          // Silently fail - RLS will handle unauthorized access
        }
      }
    }

    next();
  }
}

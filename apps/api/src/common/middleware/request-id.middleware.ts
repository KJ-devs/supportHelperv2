import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Request ID Middleware
 *
 * Ensures every request has a unique identifier for tracing and correlation.
 * Uses incoming X-Request-Id header if present, otherwise generates a new UUID.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check for existing request ID in headers (case-insensitive)
    const existingId =
      req.get('X-Request-Id') ||
      req.get('x-request-id') ||
      req.get('X-Request-ID');

    // Generate new UUID if no request ID found
    const requestId = existingId || randomUUID();

    // Store request ID on request object for later use
    (req as Request & { requestId: string }).requestId = requestId;

    // Set request ID in response header for client correlation
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}

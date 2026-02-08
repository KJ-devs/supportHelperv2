import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, runWithCorrelationId } from './logger.service';

const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Get correlation ID from header or generate a new one
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || generateCorrelationId();

    // Set correlation ID on request for later use
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Set correlation ID in response header
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Run the rest of the request with correlation ID context
    runWithCorrelationId(correlationId, () => {
      next();
    });
  }
}

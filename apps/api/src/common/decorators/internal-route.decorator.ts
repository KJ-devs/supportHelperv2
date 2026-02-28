import { SetMetadata } from '@nestjs/common';

export const IS_INTERNAL_ROUTE_KEY = 'isInternalRoute';

/**
 * Mark a route as an internal service-to-service endpoint.
 *
 * Routes marked with @InternalRoute() are skipped by JwtAuthGuard.
 * Authentication is instead handled by @UseGuards(InternalAuthGuard),
 * which verifies both the x-internal-secret header and a service-account JWT.
 *
 * @example
 * @Post('internal/analyze')
 * @InternalRoute()
 * @UseGuards(InternalAuthGuard)
 * @ApiExcludeEndpoint()
 * async internalAnalyze(@Body() dto: InternalAnalyzeDto) { ... }
 */
export const InternalRoute = () => SetMetadata(IS_INTERNAL_ROUTE_KEY, true);

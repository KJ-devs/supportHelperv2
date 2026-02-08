import { SetMetadata } from '@nestjs/common';

export const IS_SDK_ROUTE_KEY = 'isSdkRoute';

/**
 * Mark a route as SDK-authenticated (uses SDK key instead of JWT)
 * @example
 * @SdkAuth()
 * @Post('tickets')
 * async createTicket(@Body() dto: CreateTicketDto) {
 *   return this.ticketsService.create(dto);
 * }
 */
export const SdkAuth = () => SetMetadata(IS_SDK_ROUTE_KEY, true);

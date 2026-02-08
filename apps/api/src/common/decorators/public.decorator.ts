import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (bypass JWT authentication)
 * @example
 * @Public()
 * @Post('login')
 * async login(@Body() dto: LoginDto) {
 *   return this.authService.login(dto);
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

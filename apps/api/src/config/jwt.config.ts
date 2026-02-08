import { registerAs } from '@nestjs/config';

/**
 * JWT configuration
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

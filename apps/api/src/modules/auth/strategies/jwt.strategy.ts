import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../dto/auth.dto';

/**
 * JWT Authentication Strategy
 *
 * Validates JWT tokens for dashboard users
 * Extracts user information and attaches to request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Only allow access tokens (not refresh tokens)
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Cannot use refresh token for authentication');
    }

    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User will be attached to request.user
    return user;
  }
}

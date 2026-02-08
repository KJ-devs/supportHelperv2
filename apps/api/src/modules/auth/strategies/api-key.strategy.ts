import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as PassportCustomStrategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * API Key Authentication Strategy
 *
 * Validates SDK keys from x-api-key header
 * Used for SDK client authentication
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(PassportCustomStrategy, 'api-key') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request) {
    // Support both x-api-key and x-sdk-key headers for backwards compatibility
    const apiKey = (req.headers['x-api-key'] || req.headers['x-sdk-key']) as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const application = await this.authService.validateApiKey(apiKey);
    if (!application) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Application will be attached to request.user
    return application;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as PassportCustomStrategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class SdkKeyStrategy extends PassportStrategy(PassportCustomStrategy, 'sdk-key') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request) {
    const sdkKey = req.headers['x-sdk-key'] as string;

    if (!sdkKey) {
      throw new UnauthorizedException('SDK key is required');
    }

    const application = await this.authService.validateSdkKey(sdkKey);
    if (!application) {
      throw new UnauthorizedException('Invalid SDK key');
    }

    return application;
  }
}

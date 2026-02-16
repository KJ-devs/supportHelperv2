import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from '../license.service';
import { PLAN_FEATURES } from '../license.types';

@Injectable()
export class LicenseFeatureGuard implements CanActivate {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.get<string>(
      'license_feature',
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true;
    }

    if (!this.licenseService.isFeatureEnabled(requiredFeature)) {
      const requiredPlans = PLAN_FEATURES[requiredFeature] || [];
      throw new ForbiddenException(
        `Feature "${requiredFeature}" requires a ${requiredPlans.join(' or ')} plan`,
      );
    }

    return true;
  }
}

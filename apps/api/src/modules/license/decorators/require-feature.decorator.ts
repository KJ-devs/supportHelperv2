import { SetMetadata } from '@nestjs/common';

export const RequireFeature = (feature: string) =>
  SetMetadata('license_feature', feature);

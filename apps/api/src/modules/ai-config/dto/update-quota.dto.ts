import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum TenantPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export class UpdateQuotaDto {
  @ApiPropertyOptional({
    description: 'Subscription plan',
    enum: TenantPlan,
    example: TenantPlan.PRO,
  })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional({
    description: 'Monthly AI analysis quota (number of allowed AI calls)',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyQuota?: number;

  @ApiPropertyOptional({
    description:
      'Whether the tenant uses Bring Your Own Key (bypasses quota checks)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isByok?: boolean;

  @ApiPropertyOptional({
    description: 'Override the plan label stored on the quota record',
    example: 'pro',
  })
  @IsOptional()
  @IsString()
  planLabel?: string;
}

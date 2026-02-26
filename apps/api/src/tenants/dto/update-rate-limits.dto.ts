import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating tenant rate limits
 *
 * Allows configuration of rate limits per minute and per hour.
 * Used by admin endpoints to customize rate limits for specific tenants.
 */
export class UpdateRateLimitsDto {
  @ApiProperty({
    description: 'Maximum requests per minute',
    example: 200,
    minimum: 1,
    maximum: 10000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  requestsPerMinute?: number;

  @ApiProperty({
    description: 'Maximum requests per hour',
    example: 10000,
    minimum: 1,
    maximum: 500000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500000)
  requestsPerHour?: number;
}

/**
 * Rate limit configuration stored in tenant settings
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
}

/**
 * Default rate limit presets by plan
 */
export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerMinute: 10000,
    requestsPerHour: 500000,
  },
  pro: {
    requestsPerMinute: 10000,
    requestsPerHour: 500000,
  },
  enterprise: {
    requestsPerMinute: 10000,
    requestsPerHour: 500000,
  },
  default: {
    requestsPerMinute: 10000,
    requestsPerHour: 500000,
  },
};

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response from GET /github/oauth/authorize
 */
export class OAuthAuthorizeResponseDto {
  @ApiProperty({ description: 'GitHub OAuth authorization URL' })
  url: string;

  @ApiProperty({ description: 'CSRF state token (base64 encoded)' })
  state: string;
}

/**
 * Query params for GET /github/oauth/callback
 */
export class OAuthCallbackQueryDto {
  @ApiProperty({ description: 'OAuth authorization code from GitHub' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'CSRF state token for verification' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ description: 'Error code if OAuth failed' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Error description' })
  @IsOptional()
  @IsString()
  error_description?: string;
}

/**
 * Response from GET /github/oauth/callback
 */
export class OAuthCallbackResponseDto {
  @ApiProperty({ description: 'Whether OAuth was successful' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Redirect URL for frontend' })
  redirectUrl?: string;
}

/**
 * Response for GitHub connection status
 */
export class GithubConnectionStatusDto {
  @ApiProperty({ description: 'Whether GitHub is connected' })
  connected: boolean;

  @ApiPropertyOptional({ description: 'Connection ID if connected' })
  connectionId?: string;

  @ApiPropertyOptional({ description: 'Number of connected repos' })
  repoCount?: number;

  @ApiPropertyOptional({ description: 'When connection was created' })
  createdAt?: Date;
}

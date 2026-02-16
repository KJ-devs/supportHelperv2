import { IsIn, IsBoolean, IsOptional, IsString, IsUrl, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSsoConfigDto {
  @ApiProperty({ enum: ['saml', 'oidc'], description: 'SSO provider type' })
  @IsIn(['saml', 'oidc'])
  providerType: 'saml' | 'oidc';

  @ApiProperty({ description: 'Enable or disable SSO' })
  @IsBoolean()
  enabled: boolean;

  // SAML fields (when providerType = 'saml')
  @ApiProperty({ required: false, description: 'SAML Entity ID (SAML only)' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false, description: 'SAML SSO URL (SAML only)' })
  @IsOptional()
  @IsUrl()
  ssoUrl?: string;

  @ApiProperty({ required: false, description: 'SAML X.509 Certificate (SAML only)' })
  @IsOptional()
  @IsString()
  certificate?: string;

  // OIDC fields (when providerType = 'oidc')
  @ApiProperty({ required: false, description: 'OIDC Client ID (OIDC only)' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ required: false, description: 'OIDC Client Secret (OIDC only)' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiProperty({ required: false, description: 'OIDC Issuer URL (OIDC only)' })
  @IsOptional()
  @IsUrl()
  issuerUrl?: string;

  // Common
  @ApiProperty({
    required: false,
    description: 'Role mapping from IdP groups to app roles',
    example: { 'admins': 'admin', 'developers': 'member', 'viewers': 'viewer' },
  })
  @IsOptional()
  @IsObject()
  roleMapping?: Record<string, string>;

  @ApiProperty({ required: false, description: 'Auto-provision users on first login' })
  @IsOptional()
  @IsBoolean()
  autoProvision?: boolean;

  @ApiProperty({ required: false, description: 'Disable email/password login when SSO is enabled' })
  @IsOptional()
  @IsBoolean()
  disablePassword?: boolean;
}

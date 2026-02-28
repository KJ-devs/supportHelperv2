import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Acme Inc' })
  @IsString()
  @MinLength(2)
  tenantName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  tenantId: string;
  role: UserRole;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: {
    id: string;
    tenantId: string;
    email: string;
    name?: string;
    role: UserRole;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: string;
  tenant?: TenantEntity;
}

export interface TenantEntity {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings?: unknown; // Compatible with Prisma's JsonValue type
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApplicationEntity {
  id: string;
  tenantId: string;
  name: string;
  platform: string | null;
  sdkKey: string;
  tenant?: TenantEntity;
}

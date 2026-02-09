import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'My Company' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Tenant settings', example: { theme: 'dark' } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

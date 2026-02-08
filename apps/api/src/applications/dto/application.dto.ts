import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ example: 'My Web App' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'web' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'owner/repo' })
  @IsOptional()
  @IsString()
  githubRepo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ example: 'My Web App' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'web' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'owner/repo' })
  @IsOptional()
  @IsString()
  githubRepo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

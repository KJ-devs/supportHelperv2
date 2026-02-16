import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterAuditLogsDto {
  @ApiPropertyOptional({ description: 'Filter by actor ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by action (case-insensitive contains)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by resource type' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601 format)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601 format)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number (0-indexed)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 0;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;
}

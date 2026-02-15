import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchCodebaseDto {
  @ApiProperty({ description: 'Natural language search query' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Max results to return', default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

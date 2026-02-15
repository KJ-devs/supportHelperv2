import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReindexDto {
  @ApiPropertyOptional({ description: 'Commit SHA to index incrementally from' })
  @IsOptional()
  @IsString()
  sinceCommitSha?: string;
}

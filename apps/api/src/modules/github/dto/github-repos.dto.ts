import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Query params for listing repositories
 */
export class ListReposQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 30;

  @ApiPropertyOptional({
    description: 'Sort by',
    enum: ['updated', 'created', 'pushed', 'full_name'],
  })
  @IsOptional()
  @IsString()
  sort?: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated';

  @ApiPropertyOptional({ description: 'Filter by visibility', enum: ['all', 'public', 'private'] })
  @IsOptional()
  @IsString()
  visibility?: 'all' | 'public' | 'private' = 'all';
}

/**
 * Single repository in list
 */
export class GithubRepoDto {
  @ApiProperty({ description: 'GitHub repository ID' })
  id: number;

  @ApiProperty({ description: 'Repository name' })
  name: string;

  @ApiProperty({ description: 'Full name (owner/repo)' })
  fullName: string;

  @ApiProperty({ description: 'Whether repository is private' })
  private: boolean;

  @ApiProperty({ description: 'Repository URL' })
  url: string;

  @ApiPropertyOptional({ description: 'Repository description' })
  description?: string;

  @ApiProperty({ description: 'Default branch' })
  defaultBranch: string;

  @ApiProperty({ description: 'Star count' })
  starCount: number;

  @ApiProperty({ description: 'Open issues count' })
  openIssuesCount: number;

  @ApiProperty({ description: 'Last updated' })
  updatedAt: string;
}

/**
 * Response for listing repositories
 */
export class ListReposResponseDto {
  @ApiProperty({ type: [GithubRepoDto], description: 'List of repositories' })
  repositories: GithubRepoDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Has more pages' })
  hasMore: boolean;
}

/**
 * DTO for linking a repository to an application
 */
export class LinkRepoDto {
  @ApiProperty({ description: 'Application ID to link' })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ description: 'GitHub repository full name (owner/repo)' })
  @IsString()
  @IsNotEmpty()
  repository: string;
}

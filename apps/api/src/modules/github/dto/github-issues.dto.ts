import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a GitHub issue from a ticket
 */
export class CreateGithubIssueDto {
  @ApiProperty({ description: 'GitHub repository (owner/repo)' })
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiPropertyOptional({ description: 'Custom issue title (defaults to ticket title)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Additional labels to add' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({ description: 'Include video link in issue body', default: true })
  @IsOptional()
  @IsBoolean()
  includeVideoLink?: boolean = true;

  @ApiPropertyOptional({ description: 'Include AI analysis in issue body', default: true })
  @IsOptional()
  @IsBoolean()
  includeAiAnalysis?: boolean = true;

  @ApiPropertyOptional({ description: 'GitHub assignees (usernames)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignees?: string[];

  @ApiPropertyOptional({ description: 'Milestone number' })
  @IsOptional()
  milestone?: number;
}

/**
 * Response after creating a GitHub issue
 */
export class GithubIssueResponseDto {
  @ApiProperty({ description: 'Internal GitHub issue link ID' })
  id: string;

  @ApiProperty({ description: 'GitHub issue number' })
  issueNumber: number;

  @ApiProperty({ description: 'GitHub issue URL' })
  issueUrl: string;

  @ApiProperty({ description: 'Repository full name' })
  repository: string;

  @ApiProperty({ description: 'Issue title' })
  title: string;

  @ApiProperty({ description: 'Issue state' })
  state: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}

/**
 * Linked GitHub issue info
 */
export class LinkedGithubIssueDto {
  @ApiProperty({ description: 'Internal link ID' })
  id: string;

  @ApiProperty({ description: 'GitHub issue number' })
  issueNumber: number;

  @ApiProperty({ description: 'Repository full name' })
  repository: string;

  @ApiProperty({ description: 'GitHub issue URL' })
  url: string;

  @ApiProperty({ description: 'Issue state (open/closed)' })
  state: string;

  @ApiProperty({ description: 'Issue title' })
  title: string;

  @ApiProperty({ description: 'Sync status' })
  syncStatus: string;

  @ApiProperty({ description: 'Last synced at' })
  lastSyncedAt: Date;
}

/**
 * Related GitHub issue (from search)
 */
export class RelatedGithubIssueDto {
  @ApiProperty({ description: 'GitHub issue number' })
  number: number;

  @ApiProperty({ description: 'Issue title' })
  title: string;

  @ApiProperty({ description: 'Issue URL' })
  url: string;

  @ApiProperty({ description: 'Issue state' })
  state: string;

  @ApiProperty({ description: 'Labels' })
  labels: string[];

  @ApiProperty({ description: 'Similarity score (0-1)' })
  score: number;

  @ApiProperty({ description: 'Created at' })
  createdAt: string;

  @ApiProperty({ description: 'Closed at' })
  closedAt?: string;
}

/**
 * Response for related issues search
 */
export class RelatedIssuesResponseDto {
  @ApiProperty({ type: [RelatedGithubIssueDto], description: 'Related issues' })
  issues: RelatedGithubIssueDto[];

  @ApiProperty({ description: 'Search query used' })
  query: string;

  @ApiProperty({ description: 'Repository searched' })
  repository: string;
}

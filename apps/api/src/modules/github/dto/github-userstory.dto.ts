import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a User Story GitHub issue from a ticket
 */
export class CreateUserStoryDto {
  @ApiProperty({ description: 'GitHub repository (owner/repo)' })
  @IsString()
  repository: string;

  @ApiPropertyOptional({ description: 'GitHub assignees (usernames)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignees?: string[];

  @ApiPropertyOptional({ description: 'Milestone number' })
  @IsOptional()
  @IsNumber()
  milestone?: number;

  @ApiPropertyOptional({ description: 'Additional context to include in the AI prompt' })
  @IsOptional()
  @IsString()
  additionalContext?: string;
}

/**
 * Generated User Story structure from AI
 */
export class GeneratedUserStoryDto {
  @ApiProperty({ description: 'User story title in "As a [user], I want [goal] so that [benefit]" format' })
  title: string;

  @ApiProperty({ description: 'Detailed description of the user story' })
  description: string;

  @ApiProperty({ description: 'Acceptance criteria as a list of checkable items' })
  acceptanceCriteria: string[];

  @ApiProperty({ description: 'Technical implementation notes' })
  technicalNotes: string;

  @ApiProperty({ description: 'Suggested labels for the issue' })
  labels: string[];

  @ApiProperty({ description: 'Priority level: low, medium, high, critical' })
  priority: string;
}

/**
 * Response after creating a User Story issue
 */
export class UserStoryIssueResponseDto {
  @ApiProperty({ description: 'Created GitHub issue details' })
  issue: {
    id: string;
    issueNumber: number;
    issueUrl: string;
    repository: string;
    title: string;
    state: string;
    createdAt: Date;
  };

  @ApiProperty({ description: 'Generated user story data' })
  userStory: GeneratedUserStoryDto;
}

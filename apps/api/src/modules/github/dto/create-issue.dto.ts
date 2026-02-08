import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIssueDto {
  @ApiProperty({ description: 'Ticket ID to create issue from' })
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @ApiProperty({ description: 'GitHub repository (owner/repo)' })
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiProperty({ description: 'GitHub access token' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationPreferenceDto {
  @ApiProperty({ description: 'Application ID', format: 'uuid' })
  @IsString()
  applicationId: string;

  @ApiProperty({
    description: 'Notification channel',
    enum: ['email', 'webhook', 'slack'],
    example: 'email',
  })
  @IsString()
  channel: string;

  @ApiPropertyOptional({
    description: 'Event types to notify on. Empty array means all events.',
    example: ['ticket_received', 'analysis_completed', 'pr_created'],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({
    description: 'Channel-specific configuration (e.g. webhookUrl, email addresses, slackWebhookUrl)',
    example: { webhookUrl: 'https://example.com/webhook' },
    default: {},
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether this preference is enabled',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({
    description: 'Notification channel',
    enum: ['email', 'webhook', 'slack'],
  })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({
    description: 'Event types to notify on. Empty array means all events.',
    example: ['ticket_received', 'analysis_completed'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({
    description: 'Channel-specific configuration',
    example: { webhookUrl: 'https://example.com/webhook' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether this preference is enabled' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

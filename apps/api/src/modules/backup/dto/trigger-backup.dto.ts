import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerBackupDto {
  @ApiProperty({
    description: 'Whether to include media files (MinIO objects) in backup',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeMedia?: boolean = true;

  @ApiProperty({
    description: 'Human-readable label for the backup',
    example: 'Pre-migration backup',
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;
}

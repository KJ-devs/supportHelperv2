import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreBackupDto {
  @ApiProperty({
    description: 'Backup filename to restore from',
    example: 'backup_20260216_143000_manual.tar.gz',
  })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'Skip media restore (only restore database)',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  skipMedia?: boolean = false;
}

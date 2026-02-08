import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompleteUploadInput } from '../schemas/media.schema';

/**
 * Complete upload DTO
 * Uses both class-validator (for Swagger) and Zod (for validation)
 */
export class CompleteUploadDto implements CompleteUploadInput {
  @ApiProperty({
    description: 'Media ID returned from presigned URL request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  mediaId: string;

  @ApiProperty({
    description: 'S3 storage key',
    example: 'tenant-id/ticket-id/uuid.mp4',
  })
  @IsString()
  @IsNotEmpty()
  storageKey: string;

  @ApiPropertyOptional({
    description:
      'Upload checksum for verification (MD5 or SHA256 hash in hex format)',
    example: 'd41d8cd98f00b204e9800998ecf8427e',
  })
  @IsString()
  @IsOptional()
  checksum?: string;

  @ApiPropertyOptional({
    description: 'Optional video metadata extracted client-side',
    example: {
      duration: 120.5,
      width: 1920,
      height: 1080,
      codec: 'h264',
      bitrate: 2500000,
    },
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
    bitrate?: number;
  };
}

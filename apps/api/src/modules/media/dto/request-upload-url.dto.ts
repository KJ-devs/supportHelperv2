import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestUploadUrlInput } from '../schemas/media.schema';

const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/gif',
] as const;

const ALLOWED_MEDIA_TYPES = ['video', 'image', 'screenshot'] as const;

/**
 * Request upload URL DTO
 * Uses both class-validator (for Swagger) and Zod (for validation)
 */
export class RequestUploadUrlDto implements RequestUploadUrlInput {
  @ApiProperty({
    description: 'Ticket ID to attach media to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  ticketId: string;

  @ApiProperty({
    description: 'Media type',
    enum: ALLOWED_MEDIA_TYPES,
    example: 'video',
  })
  @IsString()
  @IsIn(ALLOWED_MEDIA_TYPES)
  type: 'video' | 'image' | 'screenshot';

  @ApiProperty({
    description: 'Original filename',
    example: 'recording.webm',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w\-. ]+\.(mp4|webm|mov|png|jpg|jpeg|gif)$/i, {
    message: 'Invalid filename or extension',
  })
  filename: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 50000000,
    minimum: 1,
    maximum: 500 * 1024 * 1024, // 500MB default
  })
  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024) // 500MB
  size: number;

  @ApiProperty({
    description: 'MIME type',
    enum: ALLOWED_MIME_TYPES,
    example: 'video/webm',
  })
  @IsString()
  @IsIn(ALLOWED_MIME_TYPES)
  contentType:
    | 'video/mp4'
    | 'video/webm'
    | 'video/quicktime'
    | 'image/png'
    | 'image/jpeg'
    | 'image/gif';
}

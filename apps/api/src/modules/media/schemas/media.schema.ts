import { z } from 'zod';

/**
 * Allowed MIME types for media uploads
 */
export const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/gif',
] as const;

/**
 * Allowed media types
 */
export const ALLOWED_MEDIA_TYPES = ['video', 'image', 'screenshot'] as const;

/**
 * File size limits by plan (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  free: 500 * 1024 * 1024, // 500MB
  pro: 5000 * 1024 * 1024, // 5GB
  team: 10000 * 1024 * 1024, // 10GB
  enterprise: 50000 * 1024 * 1024, // 50GB
} as const;

/**
 * Request upload URL schema
 */
export const requestUploadUrlSchema = z
  .object({
    ticketId: z
      .string({
        required_error: 'Ticket ID is required',
        invalid_type_error: 'Ticket ID must be a string',
      })
      .uuid('Ticket ID must be a valid UUID'),

    type: z.enum(ALLOWED_MEDIA_TYPES, {
      errorMap: () => ({
        message: `Type must be one of: ${ALLOWED_MEDIA_TYPES.join(', ')}`,
      }),
    }),

    filename: z
      .string({
        required_error: 'Filename is required',
        invalid_type_error: 'Filename must be a string',
      })
      .min(1, 'Filename cannot be empty')
      .max(255, 'Filename too long (max 255 characters)')
      .regex(
        /^[\w\-. ]+\.(mp4|webm|mov|png|jpg|jpeg|gif)$/i,
        'Invalid filename or file extension. Allowed: mp4, webm, mov, png, jpg, jpeg, gif',
      ),

    size: z
      .number({
        required_error: 'File size is required',
        invalid_type_error: 'File size must be a number',
      })
      .int('File size must be an integer')
      .positive('File size must be greater than 0')
      .max(
        FILE_SIZE_LIMITS.enterprise,
        `File size exceeds maximum limit (${FILE_SIZE_LIMITS.enterprise / (1024 * 1024)}MB)`,
      ),

    contentType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({
        message: `Content type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      }),
    }),
  })
  .strict();

/**
 * Complete upload schema
 */
export const completeUploadSchema = z
  .object({
    mediaId: z
      .string({
        required_error: 'Media ID is required',
        invalid_type_error: 'Media ID must be a string',
      })
      .uuid('Media ID must be a valid UUID'),

    storageKey: z
      .string({
        required_error: 'Storage key is required',
        invalid_type_error: 'Storage key must be a string',
      })
      .min(1, 'Storage key cannot be empty')
      .max(500, 'Storage key too long (max 500 characters)'),

    checksum: z
      .string()
      .regex(
        /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{64}$/,
        'Checksum must be a valid MD5 (32 chars) or SHA256 (64 chars) hash',
      )
      .optional(),

    metadata: z
      .object({
        duration: z.number().positive().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        codec: z.string().optional(),
        bitrate: z.number().positive().optional(),
      })
      .optional(),
  })
  .strict();

/**
 * TypeScript types inferred from schemas
 */
export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

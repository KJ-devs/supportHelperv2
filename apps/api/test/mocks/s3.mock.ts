/**
 * S3 Mock for Testing
 *
 * Provides mock implementations of S3 client operations.
 */

import { vi } from 'vitest';

export const mockS3Objects = new Map<string, { body: Buffer; contentType: string }>();

export const mockS3Client = {
  send: vi.fn().mockImplementation(async (command: any) => {
    const commandName = command.constructor.name;

    switch (commandName) {
      case 'PutObjectCommand': {
        const { Bucket, Key, Body, ContentType } = command.input;
        mockS3Objects.set(`${Bucket}/${Key}`, {
          body: Body,
          contentType: ContentType,
        });
        return {
          $metadata: { httpStatusCode: 200 },
          ETag: `"mock-etag-${Date.now()}"`,
        };
      }

      case 'GetObjectCommand': {
        const { Bucket, Key } = command.input;
        const object = mockS3Objects.get(`${Bucket}/${Key}`);

        if (!object) {
          const error = new Error('NoSuchKey');
          (error as any).name = 'NoSuchKey';
          throw error;
        }

        return {
          $metadata: { httpStatusCode: 200 },
          Body: {
            transformToString: async () => object.body.toString(),
            transformToByteArray: async () => object.body,
          },
          ContentType: object.contentType,
        };
      }

      case 'DeleteObjectCommand': {
        const { Bucket, Key } = command.input;
        mockS3Objects.delete(`${Bucket}/${Key}`);
        return {
          $metadata: { httpStatusCode: 204 },
        };
      }

      case 'HeadObjectCommand': {
        const { Bucket, Key } = command.input;
        const object = mockS3Objects.get(`${Bucket}/${Key}`);

        if (!object) {
          const error = new Error('NotFound');
          (error as any).name = 'NotFound';
          throw error;
        }

        return {
          $metadata: { httpStatusCode: 200 },
          ContentLength: object.body.length,
          ContentType: object.contentType,
        };
      }

      case 'ListObjectsV2Command': {
        const { Bucket, Prefix } = command.input;
        const objects = Array.from(mockS3Objects.entries())
          .filter(([key]) => key.startsWith(`${Bucket}/${Prefix || ''}`))
          .map(([key, value]) => ({
            Key: key.replace(`${Bucket}/`, ''),
            Size: value.body.length,
          }));

        return {
          $metadata: { httpStatusCode: 200 },
          Contents: objects,
          KeyCount: objects.length,
        };
      }

      default:
        throw new Error(`Unsupported command: ${commandName}`);
    }
  }),

  destroy: vi.fn(),
};

export const mockGetSignedUrl = vi.fn().mockImplementation(async (client, command, options) => {
  const { Bucket, Key } = command.input;
  return `https://${Bucket}.s3.amazonaws.com/${Key}?X-Amz-Expires=${options?.expiresIn || 3600}`;
});

// Reset function for tests
export function resetS3Mocks() {
  mockS3Objects.clear();
  mockS3Client.send.mockClear();
  mockGetSignedUrl.mockClear();
}

// Factory functions for Jest mocking
export function createMockS3Client() {
  return {
    S3Client: vi.fn().mockImplementation(() => mockS3Client),
    PutObjectCommand: vi
      .fn()
      .mockImplementation(input => ({ input, constructor: { name: 'PutObjectCommand' } })),
    GetObjectCommand: vi
      .fn()
      .mockImplementation(input => ({ input, constructor: { name: 'GetObjectCommand' } })),
    DeleteObjectCommand: vi
      .fn()
      .mockImplementation(input => ({ input, constructor: { name: 'DeleteObjectCommand' } })),
    HeadObjectCommand: vi
      .fn()
      .mockImplementation(input => ({ input, constructor: { name: 'HeadObjectCommand' } })),
    ListObjectsV2Command: vi
      .fn()
      .mockImplementation(input => ({ input, constructor: { name: 'ListObjectsV2Command' } })),
  };
}

export function createMockS3Presigner() {
  return {
    getSignedUrl: mockGetSignedUrl,
  };
}

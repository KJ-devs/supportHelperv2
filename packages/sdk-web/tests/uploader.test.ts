import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIClient } from '../src/api/api-client';

describe('APIClient', () => {
  let client: APIClient;
  const mockBaseUrl = 'https://api.test.com';
  const mockSdkKey = 'sk_test_123456';

  beforeEach(() => {
    client = new APIClient({
      baseUrl: mockBaseUrl,
      sdkKey: mockSdkKey,
      timeout: 5000,
    });

    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
  });

  describe('constructor', () => {
    it('should create client with options', () => {
      expect(client).toBeDefined();
    });

    it('should use default timeout if not provided', () => {
      const clientDefaultTimeout = new APIClient({
        baseUrl: mockBaseUrl,
        sdkKey: mockSdkKey,
      });

      expect(clientDefaultTimeout).toBeDefined();
    });
  });

  describe('createTicket', () => {
    it('should create a ticket successfully', async () => {
      const mockResponse = { id: 'ticket-123' };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.createTicket({
        title: 'Test Bug',
        description: 'Something is broken',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/sdk/tickets`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-sdk-key': mockSdkKey,
          }),
          body: JSON.stringify({
            title: 'Test Bug',
            description: 'Something is broken',
          }),
        })
      );
    });

    it('should include userContext and sessionId', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'ticket-123' }),
      } as Response);

      await client.createTicket({
        title: 'Test',
        description: 'Desc',
        userContext: { browser: 'Chrome' },
        sessionId: 'session-456',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('userContext'),
        })
      );
    });

    it('should handle error response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid data' }),
      } as Response);

      await expect(
        client.createTicket({
          title: 'Test',
          description: 'Desc',
        })
      ).rejects.toThrow('Invalid data');
    });
  });

  describe('getUploadUrl', () => {
    it('should get upload URL successfully', async () => {
      const mockResponse = {
        uploadUrl: 'https://s3.example.com/upload',
        mediaId: 'media-123',
        storageKey: 'videos/media-123.webm',
        expiresAt: '2026-01-30T00:00:00Z',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.getUploadUrl({
        ticketId: 'ticket-123',
        type: 'screen_recording',
        filename: 'recording.webm',
        size: 1024 * 1024,
        contentType: 'video/webm',
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('uploadFile', () => {
    it('should upload file to presigned URL', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      const blob = new Blob(['video data'], { type: 'video/webm' });
      await client.uploadFile('https://s3.example.com/upload', blob);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://s3.example.com/upload',
        expect.objectContaining({
          method: 'PUT',
          body: blob,
        })
      );
    });

    it('should handle upload failure', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const blob = new Blob(['video data'], { type: 'video/webm' });

      await expect(client.uploadFile('https://s3.example.com/upload', blob)).rejects.toThrow();
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const result = await client.confirmUpload('media-123');

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/sdk/media/media-123/confirm`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('timeout handling', () => {
    it('should abort request on timeout', async () => {
      vi.mocked(global.fetch).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            setTimeout(() => reject(error), 100);
          })
      );

      const shortTimeoutClient = new APIClient({
        baseUrl: mockBaseUrl,
        sdkKey: mockSdkKey,
        timeout: 50,
      });

      await expect(
        shortTimeoutClient.createTicket({
          title: 'Test',
          description: 'Desc',
        })
      ).rejects.toThrow('Request timeout');
    });
  });
});

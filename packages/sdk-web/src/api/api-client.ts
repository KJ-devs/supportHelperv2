export interface APIClientOptions {
  baseUrl: string;
  sdkKey: string;
  timeout?: number;
}

export interface UploadUrlRequest {
  ticketId: string;
  type: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  mediaId: string;
  storageKey: string;
  expiresAt: string;
}

export class APIClient {
  private baseUrl: string;
  private sdkKey: string;
  private timeout: number;

  constructor(options: APIClientOptions) {
    this.baseUrl = options.baseUrl;
    this.sdkKey = options.sdkKey;
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isSDK = true
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (isSDK) {
      headers['x-sdk-key'] = this.sdkKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async createTicket(data: {
    title: string;
    description: string;
    userContext?: Record<string, unknown>;
    sessionId?: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/api/sdk/tickets', data);
  }

  async getUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResponse> {
    return this.request('POST', '/api/sdk/media/upload-url', request);
  }

  async confirmUpload(mediaId: string): Promise<{ success: boolean }> {
    return this.request('POST', `/api/sdk/media/${mediaId}/confirm`, {});
  }

  async uploadFile(uploadUrl: string, file: Blob): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Upload failed: HTTP ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

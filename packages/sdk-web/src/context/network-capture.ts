export interface FailedNetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
  responseSnippet?: string;
  type: 'fetch' | 'xhr';
}

const MAX_ENTRIES = 20;
const MAX_SNIPPET_LENGTH = 200;
const MAX_URL_LENGTH = 200;

export class NetworkCapture {
  private static entries: FailedNetworkRequest[] = [];
  private static apiUrl = '';
  private static installed = false;

  private static originalFetch: typeof window.fetch | null = null;
  private static originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
  private static originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;

  static install(apiUrl: string): void {
    if (NetworkCapture.installed) return;
    NetworkCapture.installed = true;
    NetworkCapture.apiUrl = apiUrl;
    NetworkCapture.entries = [];
    NetworkCapture.interceptFetch();
    NetworkCapture.interceptXHR();
  }

  static uninstall(): void {
    if (!NetworkCapture.installed) return;
    NetworkCapture.installed = false;

    if (NetworkCapture.originalFetch) {
      window.fetch = NetworkCapture.originalFetch;
      NetworkCapture.originalFetch = null;
    }

    if (NetworkCapture.originalXHROpen) {
      XMLHttpRequest.prototype.open = NetworkCapture.originalXHROpen;
      NetworkCapture.originalXHROpen = null;
    }

    if (NetworkCapture.originalXHRSend) {
      XMLHttpRequest.prototype.send = NetworkCapture.originalXHRSend;
      NetworkCapture.originalXHRSend = null;
    }
  }

  static getEntries(): FailedNetworkRequest[] {
    return [...NetworkCapture.entries];
  }

  static clear(): void {
    NetworkCapture.entries = [];
  }

  private static sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url, window.location.href);
      parsed.search = parsed.search ? '[REDACTED]' : '';
      const result = parsed.toString();
      return result.length > MAX_URL_LENGTH ? result.slice(0, MAX_URL_LENGTH) : result;
    } catch {
      const questionMark = url.indexOf('?');
      const base = questionMark !== -1 ? url.slice(0, questionMark) + '?[REDACTED]' : url;
      return base.length > MAX_URL_LENGTH ? base.slice(0, MAX_URL_LENGTH) : base;
    }
  }

  private static isOwnRequest(url: string): boolean {
    if (!NetworkCapture.apiUrl) return false;
    try {
      const requestUrl = new URL(url, window.location.href);
      const ownUrl = new URL(NetworkCapture.apiUrl);
      return requestUrl.origin === ownUrl.origin && requestUrl.pathname.startsWith(ownUrl.pathname);
    } catch {
      return url.startsWith(NetworkCapture.apiUrl);
    }
  }

  private static addEntry(entry: FailedNetworkRequest): void {
    NetworkCapture.entries.push(entry);
    if (NetworkCapture.entries.length > MAX_ENTRIES) {
      NetworkCapture.entries.shift();
    }
  }

  private static interceptFetch(): void {
    NetworkCapture.originalFetch = window.fetch;
    const originalFetch = NetworkCapture.originalFetch;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (NetworkCapture.isOwnRequest(url)) {
        return originalFetch.call(window, input, init);
      }

      const start = Date.now();
      try {
        const response = await originalFetch.call(window, input, init);
        const duration = Date.now() - start;

        if (response.status >= 400) {
          let responseSnippet: string | undefined;
          try {
            const clone = response.clone();
            const text = await clone.text();
            responseSnippet = text.slice(0, MAX_SNIPPET_LENGTH);
          } catch {
            // ignore body read errors
          }

          NetworkCapture.addEntry({
            url: NetworkCapture.sanitizeUrl(url),
            method,
            status: response.status,
            statusText: response.statusText,
            duration,
            timestamp: new Date().toISOString(),
            responseSnippet,
            type: 'fetch',
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - start;
        NetworkCapture.addEntry({
          url: NetworkCapture.sanitizeUrl(url),
          method,
          status: 0,
          statusText: 'Network Error',
          duration,
          timestamp: new Date().toISOString(),
          type: 'fetch',
        });
        throw error;
      }
    };
  }

  private static interceptXHR(): void {
    NetworkCapture.originalXHROpen = XMLHttpRequest.prototype.open;
    NetworkCapture.originalXHRSend = XMLHttpRequest.prototype.send;

    const originalOpen = NetworkCapture.originalXHROpen;
    const originalSend = NetworkCapture.originalXHRSend;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      asyncFlag: boolean = true,
      username?: string | null,
      password?: string | null
    ): void {
      (this as XMLHttpRequest & { _shMethod?: string; _shUrl?: string })._shMethod =
        method.toUpperCase();
      (this as XMLHttpRequest & { _shMethod?: string; _shUrl?: string })._shUrl = String(url);
      originalOpen.call(this, method, url, asyncFlag, username ?? null, password ?? null);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
      const self = this as XMLHttpRequest & {
        _shMethod?: string;
        _shUrl?: string;
        _shStart?: number;
      };

      const url = self._shUrl ?? '';
      const method = self._shMethod ?? 'GET';

      if (NetworkCapture.isOwnRequest(url)) {
        originalSend.call(this, body);
        return;
      }

      self._shStart = Date.now();

      const handleLoad = (): void => {
        const duration = Date.now() - (self._shStart ?? Date.now());
        if (self.status >= 400) {
          let responseSnippet: string | undefined;
          try {
            const text = self.responseText;
            if (text) {
              responseSnippet = text.slice(0, MAX_SNIPPET_LENGTH);
            }
          } catch {
            // ignore
          }

          NetworkCapture.addEntry({
            url: NetworkCapture.sanitizeUrl(url),
            method,
            status: self.status,
            statusText: self.statusText,
            duration,
            timestamp: new Date().toISOString(),
            responseSnippet,
            type: 'xhr',
          });
        }
      };

      const handleError = (): void => {
        const duration = Date.now() - (self._shStart ?? Date.now());
        NetworkCapture.addEntry({
          url: NetworkCapture.sanitizeUrl(url),
          method,
          status: 0,
          statusText: 'Network Error',
          duration,
          timestamp: new Date().toISOString(),
          type: 'xhr',
        });
      };

      self.addEventListener('load', handleLoad);
      self.addEventListener('error', handleError);

      originalSend.call(this, body);
    };
  }
}

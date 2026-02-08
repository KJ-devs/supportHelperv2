export interface UserContext extends Record<string, unknown> {
  url: string;
  userAgent: string;
  timestamp: string;
  screenResolution: {
    width: number;
    height: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  timezone: string;
  language: string;
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  customContext?: Record<string, unknown>;
}

export class ContextCapture {
  static captureContext(customContext?: Record<string, unknown>): UserContext {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      screenResolution: {
        width: window.screen.width,
        height: window.screen.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      cookies: this.testStorageAccess('cookies'),
      localStorage: this.testStorageAccess('localStorage'),
      sessionStorage: this.testStorageAccess('sessionStorage'),
      customContext,
    };
  }

  private static testStorageAccess(type: 'cookies' | 'localStorage' | 'sessionStorage'): boolean {
    try {
      if (type === 'cookies') {
        return navigator.cookieEnabled;
      }

      const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
      const test = '__test__';
      storage.setItem(test, test);
      storage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

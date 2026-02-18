/**
 * WebSocket CORS Configuration Tests
 *
 * Verifies that getWebSocketCorsConfig() enforces the same origin policy
 * as the REST API — restricting connections to authorised origins in
 * production and permitting localhost in development.
 */

import {
  getWebSocketCorsConfig,
  WS_PING_INTERVAL,
  WS_PING_TIMEOUT,
} from '../../../src/config/websocket-cors.config';

/** Helper: invoke the callback-style CORS origin handler */
function checkOrigin(
  origin: string,
  corsConfig: ReturnType<typeof getWebSocketCorsConfig>,
): boolean {
  const { origin: originOption } = corsConfig;

  if (Array.isArray(originOption)) {
    return originOption.includes(origin);
  }

  if (typeof originOption === 'function') {
    let allowed = false;
    originOption(origin, (_err, result) => {
      allowed = result ?? false;
    });
    return allowed;
  }

  return false;
}

describe('getWebSocketCorsConfig', () => {
  // Preserve original environment across tests
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ----------------------------------------------------------------
  // Production mode
  // ----------------------------------------------------------------

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.DASHBOARD_URL = 'https://dashboard.example.com';
    });

    it('should return a static array of allowed origins (not a function)', () => {
      const config = getWebSocketCorsConfig();
      expect(Array.isArray(config.origin)).toBe(true);
    });

    it('should include DASHBOARD_URL in the allowed origins', () => {
      const config = getWebSocketCorsConfig();
      const origins = config.origin as string[];
      expect(origins).toContain('https://dashboard.example.com');
    });

    it('should always include localhost:3000 as a fallback', () => {
      const config = getWebSocketCorsConfig();
      const origins = config.origin as string[];
      expect(origins).toContain('http://localhost:3000');
    });

    it('should set credentials to true', () => {
      const config = getWebSocketCorsConfig();
      expect(config.credentials).toBe(true);
    });

    it('should reject a connection from an unauthorised origin', () => {
      const config = getWebSocketCorsConfig();
      const origins = config.origin as string[];
      expect(origins).not.toContain('https://attacker.com');
    });

    it('should reject a connection from a subdomain of the dashboard URL', () => {
      const config = getWebSocketCorsConfig();
      const origins = config.origin as string[];
      expect(origins).not.toContain('https://evil.dashboard.example.com');
    });

    it('should work without DASHBOARD_URL set (graceful degradation)', () => {
      delete process.env.DASHBOARD_URL;
      const config = getWebSocketCorsConfig();
      expect(Array.isArray(config.origin)).toBe(true);
      // Fallback localhost origins must still be present
      const origins = config.origin as string[];
      expect(origins.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // Development mode
  // ----------------------------------------------------------------

  describe('development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      delete process.env.DASHBOARD_URL;
    });

    it('should return a function (dynamic origin handler)', () => {
      const config = getWebSocketCorsConfig();
      expect(typeof config.origin).toBe('function');
    });

    it('should allow localhost:3000', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://localhost:3000', config)).toBe(true);
    });

    it('should allow localhost:3001', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://localhost:3001', config)).toBe(true);
    });

    it('should allow localhost:3002', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://localhost:3002', config)).toBe(true);
    });

    it('should allow arbitrary localhost ports (e.g. :4200 for ng serve)', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://localhost:4200', config)).toBe(true);
    });

    it('should allow null/undefined origin (file:// or same-origin requests)', () => {
      const config = getWebSocketCorsConfig();
      // When origin is undefined the handler should allow
      expect(checkOrigin('', config)).toBe(true);
    });

    it('should allow the literal string "null" (file:// iframe origin)', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('null', config)).toBe(true);
    });

    it('should reject a connection from an external origin', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('https://attacker.com', config)).toBe(false);
    });

    it('should reject a connection from a lookalike domain', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('https://localhost.attacker.com', config)).toBe(false);
    });

    it('should reject a connection using http (not localhost)', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://192.168.1.100:3000', config)).toBe(false);
    });

    it('should set credentials to true', () => {
      const config = getWebSocketCorsConfig();
      expect(config.credentials).toBe(true);
    });

    it('should allow DASHBOARD_URL even in development when set', () => {
      process.env.DASHBOARD_URL = 'https://staging-dashboard.example.com';
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('https://staging-dashboard.example.com', config)).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // Default behaviour (NODE_ENV unset)
  // ----------------------------------------------------------------

  describe('default behaviour (no NODE_ENV)', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
      delete process.env.DASHBOARD_URL;
    });

    it('should behave like development mode (function origin)', () => {
      const config = getWebSocketCorsConfig();
      expect(typeof config.origin).toBe('function');
    });

    it('should allow localhost connections', () => {
      const config = getWebSocketCorsConfig();
      expect(checkOrigin('http://localhost:3000', config)).toBe(true);
    });
  });
});

// ----------------------------------------------------------------
// Heartbeat constants
// ----------------------------------------------------------------

describe('WebSocket heartbeat constants', () => {
  it('WS_PING_INTERVAL should be a positive number in milliseconds', () => {
    expect(typeof WS_PING_INTERVAL).toBe('number');
    expect(WS_PING_INTERVAL).toBeGreaterThan(0);
  });

  it('WS_PING_TIMEOUT should be a positive number in milliseconds', () => {
    expect(typeof WS_PING_TIMEOUT).toBe('number');
    expect(WS_PING_TIMEOUT).toBeGreaterThan(0);
  });

  it('WS_PING_INTERVAL should be greater than WS_PING_TIMEOUT', () => {
    // Ping interval must exceed timeout so the server can detect dead connections
    expect(WS_PING_INTERVAL).toBeGreaterThan(WS_PING_TIMEOUT);
  });

  it('WS_PING_INTERVAL should be at least 10 seconds', () => {
    expect(WS_PING_INTERVAL).toBeGreaterThanOrEqual(10_000);
  });

  it('WS_PING_TIMEOUT should be at most half of WS_PING_INTERVAL', () => {
    expect(WS_PING_TIMEOUT).toBeLessThanOrEqual(WS_PING_INTERVAL / 2);
  });
});

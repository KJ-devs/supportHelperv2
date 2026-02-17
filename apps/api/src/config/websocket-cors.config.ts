/**
 * Shared WebSocket CORS configuration.
 * Uses the same origin policy as the REST API (main.ts).
 *
 * Production: restrict to DASHBOARD_URL only + localhost fallbacks.
 * Development: allow localhost and null origins (file://).
 */
export function getWebSocketCorsConfig(): {
  origin: string[] | ((origin: string, fn: (err: Error | null, allow?: boolean) => void) => void);
  credentials: boolean;
} {
  const dashboardUrl = process.env.DASHBOARD_URL;
  const nodeEnv = process.env.NODE_ENV || 'development';

  const allowedOrigins = [
    ...(dashboardUrl ? [dashboardUrl] : []),
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ];

  if (nodeEnv === 'production') {
    return {
      origin: allowedOrigins,
      credentials: true,
    };
  }

  return {
    origin: (origin: string, fn: (err: Error | null, allow?: boolean) => void) => {
      if (
        !origin ||
        origin === 'null' ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        allowedOrigins.includes(origin)
      ) {
        fn(null, true);
      } else {
        fn(null, false);
      }
    },
    credentials: true,
  };
}

/**
 * WebSocket ping interval and timeout for dead connection detection.
 */
export const WS_PING_INTERVAL = 25_000; // 25 seconds
export const WS_PING_TIMEOUT = 10_000;  // 10 seconds

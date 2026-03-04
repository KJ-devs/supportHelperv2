import * as crypto from 'crypto';

/**
 * Build a minimal HS256 JWT for worker → API internal calls.
 *
 * Used by all workers that need to authenticate against the API's
 * internal endpoints (InternalAuthGuard).
 */
export function buildServiceJwt(jwtSecret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'worker-service',
      role: 'system',
      tenantId: 'system',
      iat: now,
      exp: now + 300,
    })
  ).toString('base64url');

  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');

  return `${data}.${signature}`;
}

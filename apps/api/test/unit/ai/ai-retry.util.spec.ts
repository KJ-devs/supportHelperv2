import { withRetry, RetryOptions } from '../../../src/ai/providers/ai-retry.util';

// Minimal delay options for fast tests
const FAST_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1, // 1ms base
  multiplier: 1,
  jitter: 0,
  label: 'test',
};

describe('withRetry', () => {
  describe('success cases', () => {
    it('should return the result on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 429, message: 'rate limited' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 500, message: 'server error' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 502 and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 502, message: 'bad gateway' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 503, message: 'unavailable' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 529 (Anthropic overloaded) and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 529, message: 'overloaded' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNRESET and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on ETIMEDOUT and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times before succeeding', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 502 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(4); // 3 retries + 1 success
    });
  });

  describe('non-retryable errors', () => {
    it('should NOT retry on 400 (bad request)', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue({ status: 400, message: 'bad request' });

      await expect(withRetry(fn, FAST_OPTIONS)).rejects.toEqual({
        status: 400,
        message: 'bad request',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 (unauthorized)', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue({ status: 401, message: 'unauthorized' });

      await expect(withRetry(fn, FAST_OPTIONS)).rejects.toEqual({
        status: 401,
        message: 'unauthorized',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 403 (forbidden)', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue({ status: 403, message: 'forbidden' });

      await expect(withRetry(fn, FAST_OPTIONS)).rejects.toEqual({
        status: 403,
        message: 'forbidden',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 (not found)', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue({ status: 404, message: 'not found' });

      await expect(withRetry(fn, FAST_OPTIONS)).rejects.toEqual({
        status: 404,
        message: 'not found',
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('max retries exhausted', () => {
    it('should throw after exhausting all retries', async () => {
      const fn = jest.fn().mockRejectedValue({ status: 429, message: 'rate limited' });

      await expect(
        withRetry(fn, { ...FAST_OPTIONS, maxRetries: 2 }),
      ).rejects.toEqual({ status: 429, message: 'rate limited' });
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('Retry-After header', () => {
    it('should respect Retry-After header in seconds', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({
          status: 429,
          headers: { 'retry-after': '1' },
        })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('statusCode fallback', () => {
    it('should detect statusCode property', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ statusCode: 429 })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should detect nested error.error.status', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ error: { status: 429 } })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('network error codes', () => {
    const networkCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EPIPE',
      'EHOSTUNREACH',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_SOCKET',
      'FETCH_ERROR',
    ];

    for (const code of networkCodes) {
      it(`should retry on ${code}`, async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce({ code })
          .mockResolvedValue('ok');

        const result = await withRetry(fn, FAST_OPTIONS);
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
      });
    }
  });

  describe('nested cause.code', () => {
    it('should detect error code in cause', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ cause: { code: 'ECONNRESET' } })
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetch TypeError', () => {
    it('should retry on TypeError with fetch message', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue('ok');

      const result = await withRetry(fn, FAST_OPTIONS);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('default options', () => {
    it('should work with default options', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      const result = await withRetry(fn);
      expect(result).toBe('ok');
    });
  });
});

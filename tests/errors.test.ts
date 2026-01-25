import { describe, it, expect, vi } from 'vitest';
import {
  WhoopError,
  AuthError,
  RateLimitError,
  ExitCode,
  isWhoopError,
  sleep,
  withRetry,
} from '../src/utils/errors.js';

describe('sleep', () => {
  it('waits for specified milliseconds', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    expect(elapsed).toBeLessThan(100);
  });
});

describe('withRetry', () => {
  it('returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on RateLimitError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('rate limited', 0.01)) // 10ms retry
      .mockResolvedValue('success after retry');

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('success after retry');
    expect(fn).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });

  it('does not retry on non-RateLimitError', async () => {
    const fn = vi.fn().mockRejectedValue(new WhoopError('auth error'));

    await expect(withRetry(fn)).rejects.toThrow('auth error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new RateLimitError('rate limited', 0.01));

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(withRetry(fn, 2, 10)).rejects.toThrow('rate limited');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries

    consoleSpy.mockRestore();
  });

  it('uses Retry-After header when available', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('rate limited', 0.05)) // 50ms
      .mockResolvedValue('success');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const start = Date.now();
    await withRetry(fn, 3, 1000); // Base delay 1s but Retry-After should override
    const elapsed = Date.now() - start;

    // Should have used Retry-After (50ms) not base delay (1000ms)
    expect(elapsed).toBeLessThan(200);

    consoleSpy.mockRestore();
  });
});

describe('WhoopError', () => {
  it('creates error with message and default exit code', () => {
    const error = new WhoopError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
    expect(error.name).toBe('WhoopError');
  });

  it('creates error with custom exit code', () => {
    const error = new WhoopError('Auth failed', ExitCode.AUTH_ERROR);
    expect(error.exitCode).toBe(ExitCode.AUTH_ERROR);
  });

  it('creates error with HTTP status', () => {
    const error = new WhoopError('Not found', ExitCode.GENERAL_ERROR, 404);
    expect(error.httpStatus).toBe(404);
  });
});

describe('AuthError', () => {
  it('creates auth error with correct exit code', () => {
    const error = new AuthError('Not authenticated');
    expect(error.message).toBe('Not authenticated');
    expect(error.exitCode).toBe(ExitCode.AUTH_ERROR);
    expect(error.name).toBe('AuthError');
  });
});

describe('RateLimitError', () => {
  it('creates rate limit error', () => {
    const error = new RateLimitError('Too many requests');
    expect(error.exitCode).toBe(ExitCode.RATE_LIMIT);
    expect(error.httpStatus).toBe(429);
    expect(error.name).toBe('RateLimitError');
  });

  it('includes retry-after value', () => {
    const error = new RateLimitError('Too many requests', 60);
    expect(error.retryAfter).toBe(60);
  });
});

describe('isWhoopError', () => {
  it('returns true for WhoopError', () => {
    expect(isWhoopError(new WhoopError('test'))).toBe(true);
  });

  it('returns true for AuthError', () => {
    expect(isWhoopError(new AuthError('test'))).toBe(true);
  });

  it('returns true for RateLimitError', () => {
    expect(isWhoopError(new RateLimitError('test'))).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isWhoopError(new Error('test'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isWhoopError('string')).toBe(false);
    expect(isWhoopError(null)).toBe(false);
    expect(isWhoopError(undefined)).toBe(false);
  });
});

describe('ExitCode', () => {
  it('has correct values', () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.GENERAL_ERROR).toBe(1);
    expect(ExitCode.AUTH_ERROR).toBe(2);
    expect(ExitCode.RATE_LIMIT).toBe(3);
  });
});

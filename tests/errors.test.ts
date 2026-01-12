import { describe, it, expect } from 'vitest';
import {
  WhoopError,
  AuthError,
  RateLimitError,
  ExitCode,
  isWhoopError,
} from '../src/utils/errors.js';

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

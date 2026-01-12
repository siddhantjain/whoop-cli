/**
 * Error handling utilities
 */

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  AUTH_ERROR = 2,
  RATE_LIMIT = 3,
}

export class WhoopError extends Error {
  public readonly exitCode: ExitCode;
  public readonly httpStatus?: number;

  constructor(message: string, exitCode: ExitCode = ExitCode.GENERAL_ERROR, httpStatus?: number) {
    super(message);
    this.name = 'WhoopError';
    this.exitCode = exitCode;
    this.httpStatus = httpStatus;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends WhoopError {
  constructor(message: string) {
    super(message, ExitCode.AUTH_ERROR);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends WhoopError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, ExitCode.RATE_LIMIT, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export function handleError(error: unknown): never {
  if (error instanceof WhoopError) {
    console.error(`Error: ${error.message}`);
    if (error instanceof RateLimitError && error.retryAfter) {
      console.error(`Retry after: ${error.retryAfter} seconds`);
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('An unexpected error occurred');
  }

  process.exit(ExitCode.GENERAL_ERROR);
}

export function isWhoopError(error: unknown): error is WhoopError {
  return error instanceof WhoopError;
}

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

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on rate limit errors
      if (!(error instanceof RateLimitError)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay: use Retry-After header or exponential backoff
      const retryAfterMs = error.retryAfter ? error.retryAfter * 1000 : baseDelayMs * 2 ** attempt;

      // Log retry to stderr (keeps stdout clean for JSON)
      console.error(
        `Rate limited. Retrying in ${Math.round(retryAfterMs / 1000)}s... (attempt ${attempt + 1}/${maxRetries})`
      );

      await sleep(retryAfterMs);
    }
  }

  // If we get here, all retries failed
  throw lastError ?? new RateLimitError('Rate limit exceeded after all retries');
}

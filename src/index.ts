/**
 * whoop-cli - WHOOP API client for Node.js
 *
 * @example
 * ```typescript
 * import { getRecovery, getSleep, fetchData } from 'whoop-cli';
 *
 * // Fetch recovery data
 * const recovery = await getRecovery({ start: '2026-01-01', end: '2026-01-02' });
 *
 * // Fetch multiple data types
 * const data = await fetchData(['recovery', 'sleep'], '2026-01-12');
 * ```
 */

// Types
export type {
  WhoopProfile,
  WhoopBody,
  WhoopSleep,
  WhoopRecovery,
  WhoopWorkout,
  WhoopCycle,
  CombinedOutput,
  DataType,
  QueryParams,
  OAuthTokens,
  AuthStatus,
} from './types/whoop.js';

// API Client
export {
  getProfile,
  getBody,
  getSleep,
  getRecovery,
  getWorkout,
  getCycle,
  fetchData,
  fetchAllTypes,
} from './api/client.js';

// Auth
export { login, logout, status, refresh } from './auth/oauth.js';
export { hasTokens, getTokenDir } from './auth/tokens.js';

// Utilities
export { formatPretty, formatSummary } from './utils/format.js';
export { getWhoopDay, formatDate, formatDuration, getDateRange } from './utils/date.js';
export { WhoopError, AuthError, RateLimitError, ExitCode } from './utils/errors.js';

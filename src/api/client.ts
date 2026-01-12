/**
 * WHOOP API client
 */

import { getValidTokens } from '../auth/tokens.js';
import { BASE_URL, ENDPOINTS } from './endpoints.js';
import { WhoopError, RateLimitError, ExitCode } from '../utils/errors.js';
import { getDateRange, nowISO } from '../utils/date.js';
import type {
  WhoopProfile,
  WhoopBody,
  WhoopSleep,
  WhoopRecovery,
  WhoopWorkout,
  WhoopCycle,
  PaginatedResponse,
  QueryParams,
  CombinedOutput,
  DataType,
} from '../types/whoop.js';

/**
 * Make an authenticated API request
 */
async function request<T>(endpoint: string, params?: QueryParams): Promise<T> {
  const tokens = await getValidTokens();

  const url = new URL(BASE_URL + endpoint);

  if (params?.start) url.searchParams.set('start', params.start);
  if (params?.end) url.searchParams.set('end', params.end);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.nextToken) url.searchParams.set('nextToken', params.nextToken);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new WhoopError(
        'Authentication failed. Run: whoop auth login',
        ExitCode.AUTH_ERROR,
        401
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new RateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined
      );
    }

    throw new WhoopError(
      `API request failed: ${response.statusText}`,
      ExitCode.GENERAL_ERROR,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch all pages of a paginated endpoint
 */
async function fetchAll<T>(endpoint: string, params: QueryParams, all: boolean): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | undefined;

  do {
    const response = await request<PaginatedResponse<T>>(endpoint, {
      ...params,
      nextToken,
    });

    results.push(...response.records);
    nextToken = all ? response.next_token : undefined;
  } while (nextToken);

  return results;
}

// ============================================================================
// Individual Data Fetchers
// ============================================================================

export async function getProfile(): Promise<WhoopProfile> {
  return request<WhoopProfile>(ENDPOINTS.profile);
}

export async function getBody(): Promise<WhoopBody> {
  return request<WhoopBody>(ENDPOINTS.body);
}

export async function getSleep(params: QueryParams = {}, all = false): Promise<WhoopSleep[]> {
  return fetchAll<WhoopSleep>(ENDPOINTS.sleep, { limit: 25, ...params }, all);
}

export async function getRecovery(params: QueryParams = {}, all = false): Promise<WhoopRecovery[]> {
  return fetchAll<WhoopRecovery>(ENDPOINTS.recovery, { limit: 25, ...params }, all);
}

export async function getWorkout(params: QueryParams = {}, all = false): Promise<WhoopWorkout[]> {
  return fetchAll<WhoopWorkout>(ENDPOINTS.workout, { limit: 25, ...params }, all);
}

export async function getCycle(params: QueryParams = {}, all = false): Promise<WhoopCycle[]> {
  return fetchAll<WhoopCycle>(ENDPOINTS.cycle, { limit: 25, ...params }, all);
}

// ============================================================================
// Combined Data Fetcher
// ============================================================================

/**
 * Fetch multiple data types for a given date
 */
export async function fetchData(
  types: DataType[],
  date: string,
  options: { limit?: number; all?: boolean } = {}
): Promise<CombinedOutput> {
  const { start, end } = getDateRange(date);
  const params: QueryParams = { start, end, limit: options.limit };

  const output: CombinedOutput = {
    date,
    fetched_at: nowISO(),
  };

  // Define fetchers for each type
  const fetchers: Record<DataType, () => Promise<void>> = {
    profile: async () => {
      output.profile = await getProfile();
    },
    body: async () => {
      output.body = await getBody();
    },
    sleep: async () => {
      output.sleep = await getSleep(params, options.all);
    },
    recovery: async () => {
      output.recovery = await getRecovery(params, options.all);
    },
    workout: async () => {
      output.workout = await getWorkout(params, options.all);
    },
    cycle: async () => {
      output.cycle = await getCycle(params, options.all);
    },
  };

  // Fetch requested types in parallel
  await Promise.all(types.map((type) => fetchers[type]()));

  return output;
}

/**
 * Fetch all data types for a given date
 */
export async function fetchAllTypes(
  date: string,
  options: { limit?: number; all?: boolean } = {}
): Promise<CombinedOutput> {
  return fetchData(['profile', 'body', 'sleep', 'recovery', 'workout', 'cycle'], date, options);
}

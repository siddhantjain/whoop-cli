/**
 * WHOOP API client
 */

import { getValidTokens } from '../auth/tokens.js';
import { BASE_URL, ENDPOINTS } from './endpoints.js';
import { WhoopError, RateLimitError, ExitCode, withRetry } from '../utils/errors.js';
import { getDateRange, getDateRangeFromStartEnd, nowISO } from '../utils/date.js';
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
/**
 * Options for fetchAll
 */
interface FetchAllOptions {
  all: boolean;
  showProgress?: boolean;
}

async function fetchAll<T>(
  endpoint: string,
  params: QueryParams,
  options: FetchAllOptions
): Promise<T[]> {
  const { all, showProgress = false } = options;
  const results: T[] = [];
  let nextToken: string | undefined;
  let pageNumber = 0;

  do {
    pageNumber++;

    // Wrap each paginated request with retry logic
    const response = await withRetry(() =>
      request<PaginatedResponse<T>>(endpoint, {
        ...params,
        nextToken,
      })
    );

    results.push(...response.records);
    nextToken = all ? response.next_token : undefined;

    // Show progress to stderr (keeps stdout clean for JSON)
    if (showProgress && all) {
      console.error(`Fetching page ${pageNumber}... (${results.length} records)`);
    }
  } while (nextToken);

  if (showProgress && all && pageNumber > 1) {
    console.error(`Done! ${results.length} records fetched.`);
  }

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

export async function getSleep(
  params: QueryParams = {},
  all = false,
  showProgress = false
): Promise<WhoopSleep[]> {
  return fetchAll<WhoopSleep>(ENDPOINTS.sleep, { limit: 25, ...params }, { all, showProgress });
}

export async function getRecovery(
  params: QueryParams = {},
  all = false,
  showProgress = false
): Promise<WhoopRecovery[]> {
  return fetchAll<WhoopRecovery>(ENDPOINTS.recovery, { limit: 25, ...params }, { all, showProgress });
}

export async function getWorkout(
  params: QueryParams = {},
  all = false,
  showProgress = false
): Promise<WhoopWorkout[]> {
  return fetchAll<WhoopWorkout>(ENDPOINTS.workout, { limit: 25, ...params }, { all, showProgress });
}

export async function getCycle(
  params: QueryParams = {},
  all = false,
  showProgress = false
): Promise<WhoopCycle[]> {
  return fetchAll<WhoopCycle>(ENDPOINTS.cycle, { limit: 25, ...params }, { all, showProgress });
}

// ============================================================================
// Individual Record Lookups by ID
// ============================================================================

export async function getSleepById(id: number): Promise<WhoopSleep> {
  return withRetry(() => request<WhoopSleep>(`${ENDPOINTS.sleep}/${id}`));
}

export async function getWorkoutById(id: number): Promise<WhoopWorkout> {
  return withRetry(() => request<WhoopWorkout>(`${ENDPOINTS.workout}/${id}`));
}

export async function getCycleById(id: number): Promise<WhoopCycle> {
  return withRetry(() => request<WhoopCycle>(`${ENDPOINTS.cycle}/${id}`));
}

export async function getRecoveryByCycleId(cycleId: number): Promise<WhoopRecovery> {
  return withRetry(() => request<WhoopRecovery>(`${ENDPOINTS.recovery}/cycle/${cycleId}`));
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
  options: { limit?: number; all?: boolean; showProgress?: boolean } = {}
): Promise<CombinedOutput> {
  const { start, end } = getDateRange(date);
  const params: QueryParams = { start, end, limit: options.limit };
  const showProgress = options.showProgress ?? false;

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
      output.sleep = await getSleep(params, options.all, showProgress);
    },
    recovery: async () => {
      output.recovery = await getRecovery(params, options.all, showProgress);
    },
    workout: async () => {
      output.workout = await getWorkout(params, options.all, showProgress);
    },
    cycle: async () => {
      output.cycle = await getCycle(params, options.all, showProgress);
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

/**
 * Fetch multiple data types for a date range (start to end)
 */
export async function fetchDataRange(
  types: DataType[],
  startDate: string,
  endDate: string,
  options: { limit?: number; all?: boolean; showProgress?: boolean } = {}
): Promise<CombinedOutput> {
  const { start, end } = getDateRangeFromStartEnd(startDate, endDate);
  const params: QueryParams = { start, end, limit: options.limit };
  const showProgress = options.showProgress ?? true; // Default to true for range queries

  const output: CombinedOutput = {
    date: `${startDate} to ${endDate}`,
    fetched_at: nowISO(),
  };

  // Define fetchers for each type (profile/body don't support date ranges)
  const fetchers: Record<DataType, () => Promise<void>> = {
    profile: async () => {
      output.profile = await getProfile();
    },
    body: async () => {
      output.body = await getBody();
    },
    sleep: async () => {
      output.sleep = await getSleep(params, options.all ?? true, showProgress);
    },
    recovery: async () => {
      output.recovery = await getRecovery(params, options.all ?? true, showProgress);
    },
    workout: async () => {
      output.workout = await getWorkout(params, options.all ?? true, showProgress);
    },
    cycle: async () => {
      output.cycle = await getCycle(params, options.all ?? true, showProgress);
    },
  };

  // Fetch requested types in parallel
  await Promise.all(types.map((type) => fetchers[type]()));

  return output;
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the tokens module before importing client
vi.mock('../src/auth/tokens.js', () => ({
  getValidTokens: vi.fn().mockResolvedValue({
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    expires_at: Date.now() + 3600000,
    token_type: 'Bearer',
    scope: 'read:recovery read:sleep',
  }),
}));

// Import after mocking
import {
  getProfile,
  getBody,
  getRecovery,
  getSleep,
  getWorkout,
  getCycle,
  fetchData,
} from '../src/api/client.js';
import { WhoopError, RateLimitError, ExitCode } from '../src/utils/errors.js';

describe('API Client', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getProfile', () => {
    it('fetches profile data', async () => {
      const mockProfile: { user_id: number; email: string; first_name: string; last_name: string } =
        {
          user_id: 123,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
        };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const result = await getProfile();

      expect(result).toEqual(mockProfile);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/user/profile/basic'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock_access_token',
          }),
        })
      );
    });
  });

  describe('getBody', () => {
    it('fetches body measurements', async () => {
      const mockBody: { height_meter: number; weight_kilogram: number; max_heart_rate: number } = {
        height_meter: 1.83,
        weight_kilogram: 75,
        max_heart_rate: 185,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBody),
      });

      const result = await getBody();

      expect(result).toEqual(mockBody);
    });
  });

  describe('getRecovery', () => {
    it('fetches recovery data with pagination', async () => {
      const mockResponse = {
        records: [
          {
            cycle_id: 1,
            score: { recovery_score: 72, hrv_rmssd_milli: 45 },
          },
        ],
        next_token: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getRecovery({
        start: '2026-01-12T04:00:00Z',
        end: '2026-01-13T04:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.score.recovery_score).toBe(72);
    });

    it('fetches all pages when all=true', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              records: [{ cycle_id: 1 }],
              next_token: 'page2',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              records: [{ cycle_id: 2 }],
              next_token: undefined,
            }),
        });

      const result = await getRecovery({}, true);

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSleep', () => {
    it('fetches sleep data', async () => {
      const mockResponse = {
        records: [
          {
            id: 1,
            score: { sleep_performance_percentage: 85 },
          },
        ],
        next_token: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getSleep({
        start: '2026-01-12T04:00:00Z',
        end: '2026-01-13T04:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.score.sleep_performance_percentage).toBe(85);
    });
  });

  describe('getWorkout', () => {
    it('fetches workout data', async () => {
      const mockResponse = {
        records: [
          {
            id: 1,
            sport_id: 1,
            score: { strain: 12.5 },
          },
        ],
        next_token: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getWorkout({});

      expect(result).toHaveLength(1);
      expect(result[0]?.score.strain).toBe(12.5);
    });
  });

  describe('getCycle', () => {
    it('fetches cycle data', async () => {
      const mockResponse = {
        records: [
          {
            id: 1,
            start: '2026-01-12T00:00:00Z',
            end: '2026-01-13T00:00:00Z',
          },
        ],
        next_token: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getCycle({});

      expect(result).toHaveLength(1);
      expect(result[0]?.start).toBe('2026-01-12T00:00:00Z');
    });
  });

  describe('error handling', () => {
    it('throws AuthError on 401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(getProfile()).rejects.toThrow(WhoopError);

      // Reset and mock again for the second assertion
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const error = (await getProfile().catch((e: unknown) => e)) as WhoopError;
      expect(error).toBeInstanceOf(WhoopError);
      expect(error.exitCode).toBe(ExitCode.AUTH_ERROR);
    });

    it('throws RateLimitError on 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '60' }),
      });

      await expect(getProfile()).rejects.toThrow(RateLimitError);
    });

    it('throws WhoopError on other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getProfile()).rejects.toThrow(WhoopError);
    });
  });

  describe('fetchData', () => {
    it('fetches multiple data types in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              records: [{ score: { recovery_score: 72 } }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              records: [{ score: { sleep_performance_percentage: 85 } }],
            }),
        });

      const result = await fetchData(['recovery', 'sleep'], '2026-01-12');

      expect(result.date).toBe('2026-01-12');
      expect(result.fetched_at).toBeDefined();
      expect(result.recovery).toHaveLength(1);
      expect(result.sleep).toHaveLength(1);
    });

    it('only fetches requested types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [{ score: { recovery_score: 72 } }],
          }),
      });

      const result = await fetchData(['recovery'], '2026-01-12');

      expect(result.recovery).toBeDefined();
      expect(result.sleep).toBeUndefined();
      expect(result.workout).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

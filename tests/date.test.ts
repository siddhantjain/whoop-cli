import { describe, it, expect } from 'vitest';
import {
  getWhoopDay,
  formatDate,
  validateISODate,
  getDateRange,
  formatDuration,
  parseDateOrDefault,
} from '../src/utils/date.js';

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date('2026-01-12T15:30:00Z');
    expect(formatDate(date)).toBe('2026-01-12');
  });

  it('pads single digit months and days', () => {
    const date = new Date('2026-03-05T10:00:00Z');
    expect(formatDate(date)).toBe('2026-03-05');
  });
});

describe('getWhoopDay', () => {
  it('returns today after 4am', () => {
    const date = new Date('2026-01-12T10:00:00'); // 10am local
    expect(getWhoopDay(date)).toBe('2026-01-12');
  });

  it('returns yesterday before 4am', () => {
    const date = new Date('2026-01-12T02:00:00'); // 2am local
    expect(getWhoopDay(date)).toBe('2026-01-11');
  });

  it('returns yesterday at exactly 3:59am', () => {
    const date = new Date('2026-01-12T03:59:00'); // 3:59am local
    expect(getWhoopDay(date)).toBe('2026-01-11');
  });

  it('returns today at exactly 4am', () => {
    const date = new Date('2026-01-12T04:00:00'); // 4am local
    expect(getWhoopDay(date)).toBe('2026-01-12');
  });
});

describe('validateISODate', () => {
  it('accepts valid ISO date', () => {
    expect(validateISODate('2026-01-12')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(validateISODate('01-12-2026')).toBe(false);
    expect(validateISODate('2026/01/12')).toBe(false);
    expect(validateISODate('2026-1-12')).toBe(false);
  });

  it('rejects invalid dates', () => {
    expect(validateISODate('2026-13-01')).toBe(false); // Invalid month
    expect(validateISODate('2026-02-30')).toBe(false); // Invalid day
  });

  it('rejects non-date strings', () => {
    expect(validateISODate('not-a-date')).toBe(false);
    expect(validateISODate('')).toBe(false);
  });
});

describe('getDateRange', () => {
  it('returns start at 4am and end at 4am next day', () => {
    const { start, end } = getDateRange('2026-01-12');

    // Start should be 4am on Jan 12
    const startDate = new Date(start);
    expect(startDate.getHours()).toBe(4);
    expect(startDate.getDate()).toBe(12);

    // End should be 4am on Jan 13
    const endDate = new Date(end);
    expect(endDate.getHours()).toBe(4);
    expect(endDate.getDate()).toBe(13);
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(7200000)).toBe('2h 0m'); // 2 hours
    expect(formatDuration(5400000)).toBe('1h 30m'); // 1.5 hours
  });

  it('formats minutes only when under an hour', () => {
    expect(formatDuration(1800000)).toBe('30m'); // 30 minutes
    expect(formatDuration(300000)).toBe('5m'); // 5 minutes
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('parseDateOrDefault', () => {
  it('returns provided date if valid', () => {
    expect(parseDateOrDefault('2026-01-10')).toBe('2026-01-10');
  });

  it('returns today WHOOP day if no date provided', () => {
    const result = parseDateOrDefault();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('throws on invalid date', () => {
    expect(() => parseDateOrDefault('invalid')).toThrow('Invalid date format');
  });
});

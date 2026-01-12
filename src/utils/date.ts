/**
 * Date utilities for WHOOP API
 *
 * WHOOP uses a "WHOOP day" concept where days end at 4am local time.
 * This matches sleep patterns better than midnight boundaries.
 */

const WHOOP_DAY_HOUR_CUTOFF = 4; // 4am

/**
 * Get the current WHOOP day in YYYY-MM-DD format.
 * Before 4am, returns yesterday's date.
 */
export function getWhoopDay(now: Date = new Date()): string {
  const hour = now.getHours();

  // Before 4am, we're still on "yesterday" in WHOOP terms
  if (hour < WHOOP_DAY_HOUR_CUTOFF) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }

  return formatDate(now);
}

/**
 * Format a Date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate that a string is a valid ISO date (YYYY-MM-DD)
 */
export function validateISODate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  // Parse the date and check if it round-trips correctly
  // This catches invalid dates like Feb 30 which JS Date coerces
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return false;
  }

  // Check that the parsed date matches the input
  // (catches invalid dates like 2026-02-30 which become 2026-03-02)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

/**
 * Get start and end timestamps for a WHOOP day.
 * Start: 4am on the given date
 * End: 4am on the next date
 */
export function getDateRange(dateStr: string): { start: string; end: string } {
  const date = new Date(dateStr);

  // Start at 4am on the given date
  date.setHours(WHOOP_DAY_HOUR_CUTOFF, 0, 0, 0);
  const start = date.toISOString();

  // End at 4am the next day
  date.setDate(date.getDate() + 1);
  const end = date.toISOString();

  return { start, end };
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Parse a date string or return today's WHOOP day
 */
export function parseDateOrDefault(dateStr?: string): string {
  if (!dateStr) {
    return getWhoopDay();
  }

  if (!validateISODate(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD.`);
  }

  return dateStr;
}

/**
 * Output formatting utilities
 */

import { formatDuration } from './date.js';
import type { CombinedOutput, WhoopRecovery, WhoopSleep } from '../types/whoop.js';

/**
 * Get recovery zone color based on score
 */
function getRecoveryZone(score: number): { zone: string; emoji: string } {
  if (score >= 67) return { zone: 'Green', emoji: '🟢' };
  if (score >= 34) return { zone: 'Yellow', emoji: '🟡' };
  return { zone: 'Red', emoji: '🔴' };
}

/**
 * Format recovery data for pretty output
 */
function formatRecovery(recovery: WhoopRecovery[]): string[] {
  const lines: string[] = [];

  if (recovery.length === 0) {
    lines.push('🔋 Recovery: No data');
    return lines;
  }

  const latest = recovery[0];
  if (!latest?.score) {
    lines.push('🔋 Recovery: Pending');
    return lines;
  }

  const score = latest.score;
  const { zone, emoji } = getRecoveryZone(score.recovery_score);

  lines.push(`🔋 Recovery: ${score.recovery_score}% ${emoji} (${zone})`);
  lines.push(
    `💓 HRV: ${Math.round(score.hrv_rmssd_milli)}ms | RHR: ${score.resting_heart_rate}bpm`
  );

  if (score.spo2_percentage) {
    lines.push(`🫁 SpO2: ${score.spo2_percentage}%`);
  }

  if (score.skin_temp_celsius) {
    lines.push(`🌡️  Skin Temp: ${score.skin_temp_celsius.toFixed(1)}°C`);
  }

  return lines;
}

/**
 * Format sleep data for pretty output
 */
function formatSleep(sleep: WhoopSleep[]): string[] {
  const lines: string[] = [];

  // Filter out naps for main sleep display
  const mainSleep = sleep.filter((s) => !s.nap);
  const naps = sleep.filter((s) => s.nap);

  if (mainSleep.length === 0) {
    lines.push('😴 Sleep: No data');
    return lines;
  }

  const latest = mainSleep[0];
  if (!latest?.score) {
    lines.push('😴 Sleep: Pending');
    return lines;
  }

  const score = latest.score;
  const stages = score.stage_summary;

  const totalSleep =
    stages.total_light_sleep_time_milli +
    stages.total_slow_wave_sleep_time_milli +
    stages.total_rem_sleep_time_milli;

  lines.push(
    `😴 Sleep: ${formatDuration(totalSleep)} (${Math.round(score.sleep_efficiency_percentage)}% efficiency)`
  );
  lines.push(`   Performance: ${Math.round(score.sleep_performance_percentage)}%`);

  // Sleep stages breakdown
  lines.push(`   💤 Light: ${formatDuration(stages.total_light_sleep_time_milli)}`);
  lines.push(`   🌊 Deep: ${formatDuration(stages.total_slow_wave_sleep_time_milli)}`);
  lines.push(`   🧠 REM: ${formatDuration(stages.total_rem_sleep_time_milli)}`);
  lines.push(`   👀 Awake: ${formatDuration(stages.total_awake_time_milli)}`);

  if (naps.length > 0) {
    lines.push(`   💤 Naps: ${naps.length}`);
  }

  return lines;
}

/**
 * Format workout data for pretty output
 */
function formatWorkouts(data: CombinedOutput): string[] {
  const lines: string[] = [];
  const workouts = data.workout ?? [];

  if (workouts.length === 0) {
    lines.push('🏃 Workouts: None');
    return lines;
  }

  lines.push(`🏃 Workouts: ${workouts.length}`);

  for (const workout of workouts) {
    if (!workout.score) continue;
    const score = workout.score;
    const duration = new Date(workout.end).getTime() - new Date(workout.start).getTime();
    lines.push(
      `   🔥 Strain: ${score.strain.toFixed(1)} | ${formatDuration(duration)} | ${Math.round(score.kilojoule / 4.184)} cal`
    );
  }

  return lines;
}

/**
 * Format cycle (daily strain) for pretty output
 */
function formatCycle(data: CombinedOutput): string[] {
  const lines: string[] = [];
  const cycles = data.cycle ?? [];

  if (cycles.length === 0) {
    return lines;
  }

  const latest = cycles[0];
  if (!latest?.score) {
    return lines;
  }

  lines.push(`🔥 Daily Strain: ${latest.score.strain.toFixed(1)}`);

  return lines;
}

/**
 * Format combined output as human-readable text
 */
export function formatPretty(data: CombinedOutput): string {
  const lines: string[] = [];

  // Header
  lines.push(`💪 WHOOP Data for ${data.date}`);
  lines.push('━'.repeat(40));

  // Recovery
  if (data.recovery) {
    lines.push(...formatRecovery(data.recovery));
  }

  // Sleep
  if (data.sleep) {
    lines.push(...formatSleep(data.sleep));
  }

  // Workouts
  if (data.workout) {
    lines.push(...formatWorkouts(data));
  }

  // Daily Strain (from cycle)
  if (data.cycle) {
    lines.push(...formatCycle(data));
  }

  return lines.join('\n');
}

/**
 * Format one-line summary
 */
export function formatSummary(data: CombinedOutput): string {
  const parts: string[] = [];

  // Recovery
  const recovery = data.recovery?.[0]?.score;
  if (recovery) {
    parts.push(`Recovery: ${recovery.recovery_score}%`);
    parts.push(`HRV: ${Math.round(recovery.hrv_rmssd_milli)}ms`);
  }

  // Sleep
  const sleep = data.sleep?.find((s) => !s.nap)?.score;
  if (sleep) {
    parts.push(`Sleep: ${Math.round(sleep.sleep_performance_percentage)}%`);
  }

  // Strain (from cycle)
  const cycle = data.cycle?.[0]?.score;
  if (cycle) {
    parts.push(`Strain: ${cycle.strain.toFixed(1)}`);
  }

  if (parts.length === 0) {
    return 'No data available';
  }

  return parts.join(' | ');
}

// ============================================================================
// CSV Formatting
// ============================================================================

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format recovery data as CSV
 */
export function formatRecoveryCSV(data: CombinedOutput): string {
  const headers = [
    'date',
    'recovery_score',
    'hrv_rmssd_milli',
    'resting_heart_rate',
    'spo2_percentage',
    'skin_temp_celsius',
    'cycle_id',
    'created_at',
  ];

  const lines: string[] = [headers.join(',')];

  for (const r of data.recovery ?? []) {
    const score = r.score;
    const row = [
      escapeCSV(data.date),
      escapeCSV(score?.recovery_score),
      escapeCSV(score?.hrv_rmssd_milli),
      escapeCSV(score?.resting_heart_rate),
      escapeCSV(score?.spo2_percentage),
      escapeCSV(score?.skin_temp_celsius),
      escapeCSV(r.cycle_id),
      escapeCSV(r.created_at),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Format sleep data as CSV
 */
export function formatSleepCSV(data: CombinedOutput): string {
  const headers = [
    'date',
    'start',
    'end',
    'nap',
    'sleep_performance_percentage',
    'sleep_efficiency_percentage',
    'total_sleep_milli',
    'light_sleep_milli',
    'deep_sleep_milli',
    'rem_sleep_milli',
    'awake_milli',
    'respiratory_rate',
    'sleep_id',
  ];

  const lines: string[] = [headers.join(',')];

  for (const s of data.sleep ?? []) {
    const score = s.score;
    const stages = score?.stage_summary;
    const totalSleep = stages
      ? stages.total_light_sleep_time_milli +
        stages.total_slow_wave_sleep_time_milli +
        stages.total_rem_sleep_time_milli
      : null;

    const row = [
      escapeCSV(data.date),
      escapeCSV(s.start),
      escapeCSV(s.end),
      escapeCSV(s.nap),
      escapeCSV(score?.sleep_performance_percentage),
      escapeCSV(score?.sleep_efficiency_percentage),
      escapeCSV(totalSleep),
      escapeCSV(stages?.total_light_sleep_time_milli),
      escapeCSV(stages?.total_slow_wave_sleep_time_milli),
      escapeCSV(stages?.total_rem_sleep_time_milli),
      escapeCSV(stages?.total_awake_time_milli),
      escapeCSV(score?.respiratory_rate),
      escapeCSV(s.id),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Format workout data as CSV
 */
export function formatWorkoutCSV(data: CombinedOutput): string {
  const headers = [
    'date',
    'start',
    'end',
    'sport_id',
    'strain',
    'average_heart_rate',
    'max_heart_rate',
    'kilojoule',
    'distance_meter',
    'workout_id',
  ];

  const lines: string[] = [headers.join(',')];

  for (const w of data.workout ?? []) {
    const score = w.score;
    const row = [
      escapeCSV(data.date),
      escapeCSV(w.start),
      escapeCSV(w.end),
      escapeCSV(w.sport_id),
      escapeCSV(score?.strain),
      escapeCSV(score?.average_heart_rate),
      escapeCSV(score?.max_heart_rate),
      escapeCSV(score?.kilojoule),
      escapeCSV(score?.distance_meter),
      escapeCSV(w.id),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Format cycle data as CSV
 */
export function formatCycleCSV(data: CombinedOutput): string {
  const headers = ['date', 'start', 'end', 'strain', 'kilojoule', 'average_heart_rate', 'cycle_id'];

  const lines: string[] = [headers.join(',')];

  for (const c of data.cycle ?? []) {
    const score = c.score;
    const row = [
      escapeCSV(data.date),
      escapeCSV(c.start),
      escapeCSV(c.end),
      escapeCSV(score?.strain),
      escapeCSV(score?.kilojoule),
      escapeCSV(score?.average_heart_rate),
      escapeCSV(c.id),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Format data as CSV based on available data type
 */
export function formatCSV(data: CombinedOutput, dataType?: string): string {
  // Determine the primary data type
  if (dataType === 'recovery' || (data.recovery && data.recovery.length > 0 && !dataType)) {
    return formatRecoveryCSV(data);
  }
  if (dataType === 'sleep' || (data.sleep && data.sleep.length > 0 && !dataType)) {
    return formatSleepCSV(data);
  }
  if (dataType === 'workout' || (data.workout && data.workout.length > 0 && !dataType)) {
    return formatWorkoutCSV(data);
  }
  if (dataType === 'cycle' || (data.cycle && data.cycle.length > 0 && !dataType)) {
    return formatCycleCSV(data);
  }

  return 'No data available for CSV export';
}

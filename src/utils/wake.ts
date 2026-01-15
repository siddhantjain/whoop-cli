/**
 * Adaptive Wake Detection Algorithm
 * 
 * Uses rolling 7-day sleep statistics to determine if the user is
 * actually awake for the day vs experiencing a mid-sleep wake.
 * 
 * The algorithm adapts to individual sleep patterns rather than
 * using fixed thresholds.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.whoop-cli');
const HISTORY_FILE = join(CONFIG_DIR, 'sleep-history.json');
const HISTORY_DAYS = 14; // Keep 2 weeks of history
const ROLLING_WINDOW = 7; // Use 7 days for rolling stats

export interface SleepRecord {
  date: string;
  endUtcHour: number;
  durationHours: number;
  cycles: number;
  performance: number;
  efficiency: number;
}

export interface RollingStats {
  avgEndHour: number;
  minEndHour: number;
  avgDuration: number;
  minDuration: number;
  avgCycles: number;
  minCycles: number;
  avgPerformance: number;
  minPerformance: number;
  sampleSize: number;
}

export interface WakeCheckResult {
  isAwake: boolean;
  score: number;
  maxScore: number;
  confidence: 'high' | 'medium' | 'low';
  sleep: {
    endTime: string;
    endHourUtc: number;
    durationHours: number;
    cycles: number;
    performance: number;
  };
  thresholds: {
    endHourMin: number;
    durationMin: number;
    cyclesMin: number;
    performanceMin: number;
  };
  checks: {
    name: string;
    passed: boolean;
    points: number;
    detail: string;
  }[];
  stats: RollingStats;
}

/**
 * Load sleep history from disk
 */
export function loadHistory(): SleepRecord[] {
  if (!existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save sleep history to disk
 */
export function saveHistory(history: SleepRecord[]): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  // Keep only last HISTORY_DAYS
  const trimmed = history.slice(-HISTORY_DAYS);
  writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Add a sleep record to history (dedupes by date)
 */
export function addToHistory(record: SleepRecord): void {
  const history = loadHistory();
  const existing = history.findIndex(h => h.date === record.date);
  if (existing >= 0) {
    history[existing] = record; // Update existing
  } else {
    history.push(record);
  }
  // Sort by date
  history.sort((a, b) => a.date.localeCompare(b.date));
  saveHistory(history);
}

/**
 * Calculate rolling statistics from history
 */
export function calculateRollingStats(history: SleepRecord[]): RollingStats {
  const recent = history.slice(-ROLLING_WINDOW);
  
  if (recent.length === 0) {
    // Default stats for new users
    return {
      avgEndHour: 14, // 6 AM PT
      minEndHour: 13, // 5 AM PT
      avgDuration: 7,
      minDuration: 5,
      avgCycles: 4,
      minCycles: 3,
      avgPerformance: 80,
      minPerformance: 70,
      sampleSize: 0,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => sum(arr) / arr.length;
  const min = (arr: number[]) => Math.min(...arr);

  return {
    avgEndHour: Math.round(avg(recent.map(r => r.endUtcHour)) * 10) / 10,
    minEndHour: min(recent.map(r => r.endUtcHour)),
    avgDuration: Math.round(avg(recent.map(r => r.durationHours)) * 10) / 10,
    minDuration: Math.round(min(recent.map(r => r.durationHours)) * 10) / 10,
    avgCycles: Math.round(avg(recent.map(r => r.cycles)) * 10) / 10,
    minCycles: min(recent.map(r => r.cycles)),
    avgPerformance: Math.round(avg(recent.map(r => r.performance))),
    minPerformance: min(recent.map(r => r.performance)),
    sampleSize: recent.length,
  };
}

/**
 * Parse WHOOP sleep data into a SleepRecord
 */
export function parseSleepRecord(sleep: any): SleepRecord | null {
  if (!sleep || !sleep.end || !sleep.score) {
    return null;
  }

  const endTime = new Date(sleep.end);
  const stages = sleep.score.stage_summary;

  return {
    date: sleep.start.split('T')[0],
    endUtcHour: endTime.getUTCHours(),
    durationHours: (stages.total_in_bed_time_milli || 0) / 3600000,
    cycles: stages.sleep_cycle_count || 0,
    performance: sleep.score.sleep_performance_percentage || 0,
    efficiency: sleep.score.sleep_efficiency_percentage || 0,
  };
}

/**
 * Main wake detection algorithm
 */
export function checkWake(currentSleep: any, history?: SleepRecord[]): WakeCheckResult {
  const sleepRecord = parseSleepRecord(currentSleep);
  
  if (!sleepRecord) {
    throw new Error('Invalid sleep data');
  }

  // Load history if not provided
  const sleepHistory = history ?? loadHistory();
  
  // Calculate rolling stats (excluding today)
  const historyWithoutToday = sleepHistory.filter(h => h.date !== sleepRecord.date);
  const stats = calculateRollingStats(historyWithoutToday);

  // Calculate adaptive thresholds
  const thresholds = {
    endHourMin: stats.minEndHour - 2, // 2 hours before typical minimum
    durationMin: Math.round(stats.avgDuration * 0.7 * 10) / 10, // 70% of average
    cyclesMin: Math.max(stats.minCycles - 1, 2), // min - 1, but at least 2
    performanceMin: Math.round(stats.avgPerformance * 0.75), // 75% of average
  };

  // Run checks
  const checks: WakeCheckResult['checks'] = [];
  let score = 0;

  // Check 1: End hour (most important - 5 points)
  const endHourOk = sleepRecord.endUtcHour >= thresholds.endHourMin;
  const endHourGood = sleepRecord.endUtcHour >= stats.minEndHour;
  if (endHourOk) {
    score += 3;
    checks.push({
      name: 'end_hour_minimum',
      passed: true,
      points: 3,
      detail: `${sleepRecord.endUtcHour} UTC >= ${thresholds.endHourMin} UTC (min - 2h)`,
    });
  } else {
    checks.push({
      name: 'end_hour_minimum',
      passed: false,
      points: 0,
      detail: `${sleepRecord.endUtcHour} UTC < ${thresholds.endHourMin} UTC (too early)`,
    });
  }
  
  if (endHourGood) {
    score += 2;
    checks.push({
      name: 'end_hour_typical',
      passed: true,
      points: 2,
      detail: `${sleepRecord.endUtcHour} UTC >= ${stats.minEndHour} UTC (typical min)`,
    });
  } else {
    checks.push({
      name: 'end_hour_typical',
      passed: false,
      points: 0,
      detail: `${sleepRecord.endUtcHour} UTC < ${stats.minEndHour} UTC (earlier than typical)`,
    });
  }

  // Check 2: Duration (2 points)
  const durationOk = sleepRecord.durationHours >= thresholds.durationMin;
  if (durationOk) {
    score += 2;
    checks.push({
      name: 'duration',
      passed: true,
      points: 2,
      detail: `${sleepRecord.durationHours.toFixed(1)}h >= ${thresholds.durationMin}h (70% of avg)`,
    });
  } else {
    checks.push({
      name: 'duration',
      passed: false,
      points: 0,
      detail: `${sleepRecord.durationHours.toFixed(1)}h < ${thresholds.durationMin}h (too short)`,
    });
  }

  // Check 3: Cycles (2 points)
  const cyclesOk = sleepRecord.cycles >= thresholds.cyclesMin;
  if (cyclesOk) {
    score += 2;
    checks.push({
      name: 'cycles',
      passed: true,
      points: 2,
      detail: `${sleepRecord.cycles} cycles >= ${thresholds.cyclesMin} (min - 1)`,
    });
  } else {
    checks.push({
      name: 'cycles',
      passed: false,
      points: 0,
      detail: `${sleepRecord.cycles} cycles < ${thresholds.cyclesMin} (incomplete sleep)`,
    });
  }

  // Check 4: Performance (1 point)
  const perfOk = sleepRecord.performance >= thresholds.performanceMin;
  if (perfOk) {
    score += 1;
    checks.push({
      name: 'performance',
      passed: true,
      points: 1,
      detail: `${sleepRecord.performance}% >= ${thresholds.performanceMin}% (75% of avg)`,
    });
  } else {
    checks.push({
      name: 'performance',
      passed: false,
      points: 0,
      detail: `${sleepRecord.performance}% < ${thresholds.performanceMin}% (below typical)`,
    });
  }

  // Determine confidence based on history size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (stats.sampleSize >= 7) {
    confidence = 'high';
  } else if (stats.sampleSize >= 3) {
    confidence = 'medium';
  }

  const isAwake = score >= 6;

  // Add to history if this looks like a real wake
  if (isAwake) {
    addToHistory(sleepRecord);
  }

  return {
    isAwake,
    score,
    maxScore: 10,
    confidence,
    sleep: {
      endTime: currentSleep.end,
      endHourUtc: sleepRecord.endUtcHour,
      durationHours: Math.round(sleepRecord.durationHours * 10) / 10,
      cycles: sleepRecord.cycles,
      performance: sleepRecord.performance,
    },
    thresholds,
    checks,
    stats,
  };
}

/**
 * Format wake check result for pretty output
 */
export function formatWakeResult(result: WakeCheckResult): string {
  const status = result.isAwake ? '✅ AWAKE' : '❌ NOT AWAKE (mid-sleep wake detected)';
  const confidence = `Confidence: ${result.confidence} (${result.stats.sampleSize} days of history)`;
  
  let output = `\n${status}\n`;
  output += `Score: ${result.score}/${result.maxScore} (threshold: 6)\n`;
  output += `${confidence}\n\n`;
  
  output += `Current Sleep:\n`;
  output += `  End time: ${result.sleep.endTime}\n`;
  output += `  Duration: ${result.sleep.durationHours}h\n`;
  output += `  Cycles: ${result.sleep.cycles}\n`;
  output += `  Performance: ${result.sleep.performance}%\n\n`;
  
  output += `Adaptive Thresholds (from your history):\n`;
  output += `  End hour: >= ${result.thresholds.endHourMin} UTC\n`;
  output += `  Duration: >= ${result.thresholds.durationMin}h\n`;
  output += `  Cycles: >= ${result.thresholds.cyclesMin}\n`;
  output += `  Performance: >= ${result.thresholds.performanceMin}%\n\n`;
  
  output += `Checks:\n`;
  for (const check of result.checks) {
    const icon = check.passed ? '✓' : '✗';
    output += `  ${icon} ${check.name}: ${check.detail}\n`;
  }
  
  return output;
}

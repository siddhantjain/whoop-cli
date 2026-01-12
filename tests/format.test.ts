import { describe, it, expect } from 'vitest';
import { formatPretty, formatSummary } from '../src/utils/format.js';
import type { CombinedOutput, WhoopRecovery, WhoopSleep, WhoopCycle } from '../src/types/whoop.js';

const mockRecovery: WhoopRecovery = {
  cycle_id: 123,
  sleep_id: 456,
  user_id: 789,
  created_at: '2026-01-12T10:00:00Z',
  updated_at: '2026-01-12T10:00:00Z',
  score_state: 'SCORED',
  score: {
    user_calibrating: false,
    recovery_score: 72,
    resting_heart_rate: 52,
    hrv_rmssd_milli: 45.2,
    spo2_percentage: 96.5,
    skin_temp_celsius: 33.1,
  },
};

const mockSleep: WhoopSleep = {
  id: 456,
  user_id: 789,
  created_at: '2026-01-12T06:00:00Z',
  updated_at: '2026-01-12T06:00:00Z',
  start: '2026-01-11T22:00:00Z',
  end: '2026-01-12T06:00:00Z',
  timezone_offset: '-08:00',
  nap: false,
  score_state: 'SCORED',
  score: {
    stage_summary: {
      total_in_bed_time_milli: 28800000, // 8 hours
      total_awake_time_milli: 1800000, // 30 min
      total_no_data_time_milli: 0,
      total_light_sleep_time_milli: 14400000, // 4 hours
      total_slow_wave_sleep_time_milli: 7200000, // 2 hours
      total_rem_sleep_time_milli: 5400000, // 1.5 hours
      sleep_cycle_count: 4,
      disturbance_count: 2,
    },
    sleep_needed: {
      baseline_milli: 28800000,
      need_from_sleep_debt_milli: 0,
      need_from_recent_strain_milli: 0,
      need_from_recent_nap_milli: 0,
    },
    respiratory_rate: 14.2,
    sleep_performance_percentage: 85,
    sleep_consistency_percentage: 78,
    sleep_efficiency_percentage: 90,
  },
};

const mockCycle: WhoopCycle = {
  id: 999,
  user_id: 789,
  created_at: '2026-01-12T04:00:00Z',
  updated_at: '2026-01-12T20:00:00Z',
  start: '2026-01-12T04:00:00Z',
  end: '2026-01-13T04:00:00Z',
  timezone_offset: '-08:00',
  score_state: 'SCORED',
  score: {
    strain: 8.2,
    kilojoule: 8500,
    average_heart_rate: 72,
    max_heart_rate: 165,
  },
};

describe('formatSummary', () => {
  it('formats recovery, sleep, and strain', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [mockRecovery],
      sleep: [mockSleep],
      cycle: [mockCycle],
    };

    const result = formatSummary(data);

    expect(result).toContain('Recovery: 72%');
    expect(result).toContain('HRV: 45ms');
    expect(result).toContain('Sleep: 85%');
    expect(result).toContain('Strain: 8.2');
  });

  it('handles missing data', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
    };

    const result = formatSummary(data);
    expect(result).toBe('No data available');
  });

  it('handles partial data', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [mockRecovery],
    };

    const result = formatSummary(data);
    expect(result).toContain('Recovery: 72%');
    expect(result).not.toContain('Sleep:');
  });
});

describe('formatPretty', () => {
  it('formats complete data with header', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [mockRecovery],
      sleep: [mockSleep],
      cycle: [mockCycle],
    };

    const result = formatPretty(data);

    // Header
    expect(result).toContain('WHOOP Data for 2026-01-12');
    expect(result).toContain('━');

    // Recovery
    expect(result).toContain('Recovery: 72%');
    expect(result).toContain('Green');
    expect(result).toContain('HRV: 45ms');
    expect(result).toContain('RHR: 52bpm');
    expect(result).toContain('SpO2: 96.5%');

    // Sleep
    expect(result).toContain('Sleep:');
    expect(result).toContain('90% efficiency');
    expect(result).toContain('Light:');
    expect(result).toContain('Deep:');
    expect(result).toContain('REM:');

    // Strain
    expect(result).toContain('Daily Strain: 8.2');
  });

  it('shows yellow zone for mid recovery', () => {
    const midRecovery = {
      ...mockRecovery,
      score: { ...mockRecovery.score, recovery_score: 50 },
    };
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [midRecovery],
    };

    const result = formatPretty(data);
    expect(result).toContain('Yellow');
  });

  it('shows red zone for low recovery', () => {
    const lowRecovery = {
      ...mockRecovery,
      score: { ...mockRecovery.score, recovery_score: 25 },
    };
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [lowRecovery],
    };

    const result = formatPretty(data);
    expect(result).toContain('Red');
  });

  it('handles empty recovery array', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      recovery: [],
    };

    const result = formatPretty(data);
    expect(result).toContain('Recovery: No data');
  });

  it('handles empty sleep array', () => {
    const data: CombinedOutput = {
      date: '2026-01-12',
      fetched_at: '2026-01-12T15:00:00Z',
      sleep: [],
    };

    const result = formatPretty(data);
    expect(result).toContain('Sleep: No data');
  });
});

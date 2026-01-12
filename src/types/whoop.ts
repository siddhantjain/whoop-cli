/**
 * WHOOP API v2 Type Definitions
 * @see https://developer.whoop.com/api
 */

// ============================================================================
// Profile & Body
// ============================================================================

export interface WhoopProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopBody {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

// ============================================================================
// Sleep
// ============================================================================

export interface SleepStages {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

export interface SleepNeeded {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
}

export interface SleepScore {
  stage_summary: SleepStages;
  sleep_needed: SleepNeeded;
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
}

export interface WhoopSleep {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: SleepScore;
}

// ============================================================================
// Recovery
// ============================================================================

export interface RecoveryScore {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage?: number;
  skin_temp_celsius?: number;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: RecoveryScore;
}

// ============================================================================
// Workout
// ============================================================================

export interface WorkoutZones {
  zone_zero_milli: number;
  zone_one_milli: number;
  zone_two_milli: number;
  zone_three_milli: number;
  zone_four_milli: number;
  zone_five_milli: number;
}

export interface WorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_duration: WorkoutZones;
}

export interface WhoopWorkout {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: WorkoutScore;
}

// ============================================================================
// Cycle
// ============================================================================

export interface CycleScore {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: CycleScore;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  records: T[];
  next_token?: string;
}

export interface QueryParams {
  start?: string;
  end?: string;
  limit?: number;
  nextToken?: string;
}

// ============================================================================
// Combined Output
// ============================================================================

export type DataType = 'profile' | 'body' | 'sleep' | 'recovery' | 'workout' | 'cycle';

export interface CombinedOutput {
  date: string;
  fetched_at: string;
  profile?: WhoopProfile;
  body?: WhoopBody;
  sleep?: WhoopSleep[];
  recovery?: WhoopRecovery[];
  workout?: WhoopWorkout[];
  cycle?: WhoopCycle[];
}

export type WhoopData =
  | WhoopProfile
  | WhoopBody
  | WhoopSleep[]
  | WhoopRecovery[]
  | WhoopWorkout[]
  | WhoopCycle[]
  | CombinedOutput;

// ============================================================================
// Auth Types
// ============================================================================

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  scope: string;
}

export interface EncryptedTokens {
  encrypted: string;
  iv: string;
  tag: string;
  version: number;
}

export interface AuthStatus {
  authenticated: boolean;
  expires_at?: string;
  scopes?: string[];
}

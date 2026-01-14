/**
 * WHOOP API v2 endpoints
 */

export const BASE_URL = process.env['WHOOP_API_URL'] ?? 'https://api.prod.whoop.com/developer';

export const ENDPOINTS = {
  profile: '/v2/user/profile/basic',
  body: '/v2/user/measurement/body',
  sleep: '/v2/activity/sleep',
  recovery: '/v2/recovery',
  workout: '/v2/activity/workout',
  cycle: '/v2/cycle',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

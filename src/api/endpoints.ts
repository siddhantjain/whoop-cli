/**
 * WHOOP API v2 endpoints
 */

export const BASE_URL = 'https://api.prod.whoop.com/developer';

export const ENDPOINTS = {
  profile: '/v1/user/profile/basic',
  body: '/v1/user/measurement/body',
  sleep: '/v1/activity/sleep',
  recovery: '/v1/recovery',
  workout: '/v1/activity/workout',
  cycle: '/v1/cycle',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

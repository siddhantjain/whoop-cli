/**
 * Token storage and management
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { encrypt, decrypt, type EncryptedData } from '../utils/crypto.js';
import { AuthError } from '../utils/errors.js';
import type { OAuthTokens } from '../types/whoop.js';

const TOKEN_DIR = process.env['WHOOP_TOKEN_PATH'] ?? join(homedir(), '.whoop-cli');
const TOKEN_FILE = join(TOKEN_DIR, 'tokens.json');

// Buffer time before expiration (5 minutes)
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// In-memory token cache to avoid excessive disk reads and refreshes
let cachedTokens: OAuthTokens | null = null;

// Track refresh attempts for rate limiting warnings
let refreshCount = 0;
let refreshWindowStart = Date.now();
const REFRESH_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_WARNING_THRESHOLD = 50; // Warn after 50 refreshes per hour

/**
 * Ensure the token directory exists
 */
function ensureTokenDir(): void {
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Save tokens (encrypted) to disk and update cache
 */
export function saveTokens(tokens: OAuthTokens): void {
  ensureTokenDir();

  const json = JSON.stringify(tokens);
  const encrypted = encrypt(json);

  writeFileSync(TOKEN_FILE, JSON.stringify(encrypted, null, 2), {
    mode: 0o600,
  });

  // Update in-memory cache
  cachedTokens = tokens;
}

/**
 * Load tokens from disk (decrypts automatically) with caching
 */
export function loadTokens(): OAuthTokens | null {
  // Return cached tokens if available and not expired
  if (cachedTokens && !isTokenExpired(cachedTokens)) {
    return cachedTokens;
  }

  if (!existsSync(TOKEN_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(TOKEN_FILE, 'utf8');
    const encrypted = JSON.parse(content) as EncryptedData;
    const decrypted = decrypt(encrypted);
    cachedTokens = JSON.parse(decrypted) as OAuthTokens;
    return cachedTokens;
  } catch {
    // If decryption fails, tokens were encrypted on a different machine
    // or the file is corrupted
    return null;
  }
}

/**
 * Delete stored tokens and clear cache
 */
export function deleteTokens(): void {
  cachedTokens = null;
  if (existsSync(TOKEN_FILE)) {
    rmSync(TOKEN_FILE);
  }
}

/**
 * Check if tokens exist
 */
export function hasTokens(): boolean {
  return existsSync(TOKEN_FILE);
}

/**
 * Check if access token is expired (or about to expire)
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  const now = Date.now();
  return tokens.expires_at - EXPIRY_BUFFER_MS <= now;
}

/**
 * Track and warn about excessive token refreshes
 */
function trackRefresh(): void {
  const now = Date.now();

  // Reset counter if window has passed
  if (now - refreshWindowStart > REFRESH_WINDOW_MS) {
    refreshCount = 0;
    refreshWindowStart = now;
  }

  refreshCount++;

  // Warn if approaching limits
  if (refreshCount === REFRESH_WARNING_THRESHOLD) {
    console.error(
      `⚠️  Warning: ${refreshCount} token refreshes in the last hour. ` +
        `Heavy usage may exhaust your refresh token.`
    );
    console.error(`   Tip: Use --start/--end for bulk data instead of day-by-day fetching.`);
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(tokens: OAuthTokens): Promise<OAuthTokens> {
  const clientId = process.env['WHOOP_CLIENT_ID'];
  const clientSecret = process.env['WHOOP_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new AuthError('WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set');
  }

  trackRefresh();

  const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'offline',
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    // Provide helpful error message for token exhaustion
    if (error.includes('invalid_request') || error.includes('invalid_grant')) {
      throw new AuthError(
        `Refresh token expired or invalid. This can happen after heavy API usage.\n` +
          `To re-authenticate: whoop auth login\n` +
          `Tip: Use --start/--end for bulk fetching to reduce token refreshes.`
      );
    }

    throw new AuthError(`Failed to refresh token: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const newTokens: OAuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  };

  saveTokens(newTokens);
  return newTokens;
}

/**
 * Get valid tokens, refreshing if necessary
 * Uses in-memory cache to minimize disk reads and token refreshes
 */
export async function getValidTokens(): Promise<OAuthTokens> {
  // First check in-memory cache
  if (cachedTokens && !isTokenExpired(cachedTokens)) {
    return cachedTokens;
  }

  // Load from disk
  const tokens = loadTokens();

  if (!tokens) {
    throw new AuthError('Not authenticated. Run: whoop auth login');
  }

  // Check if cached tokens are still valid (loadTokens may have updated cache)
  if (!isTokenExpired(tokens)) {
    return tokens;
  }

  // Need to refresh
  return refreshAccessToken(tokens);
}

/**
 * Get token directory path (for display purposes)
 */
export function getTokenDir(): string {
  return TOKEN_DIR;
}

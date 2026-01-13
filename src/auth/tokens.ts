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

/**
 * Ensure the token directory exists
 */
function ensureTokenDir(): void {
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Save tokens (encrypted) to disk
 */
export function saveTokens(tokens: OAuthTokens): void {
  ensureTokenDir();

  const json = JSON.stringify(tokens);
  const encrypted = encrypt(json);

  writeFileSync(TOKEN_FILE, JSON.stringify(encrypted, null, 2), {
    mode: 0o600,
  });
}

/**
 * Load tokens from disk (decrypts automatically)
 */
export function loadTokens(): OAuthTokens | null {
  if (!existsSync(TOKEN_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(TOKEN_FILE, 'utf8');
    const encrypted = JSON.parse(content) as EncryptedData;
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted) as OAuthTokens;
  } catch {
    // If decryption fails, tokens were encrypted on a different machine
    // or the file is corrupted
    return null;
  }
}

/**
 * Delete stored tokens
 */
export function deleteTokens(): void {
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
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(tokens: OAuthTokens): Promise<OAuthTokens> {
  const clientId = process.env['WHOOP_CLIENT_ID'];
  const clientSecret = process.env['WHOOP_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new AuthError('WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be set');
  }

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
 */
export async function getValidTokens(): Promise<OAuthTokens> {
  const tokens = loadTokens();

  if (!tokens) {
    throw new AuthError('Not authenticated. Run: whoop auth login');
  }

  if (isTokenExpired(tokens)) {
    return refreshAccessToken(tokens);
  }

  return tokens;
}

/**
 * Get token directory path (for display purposes)
 */
export function getTokenDir(): string {
  return TOKEN_DIR;
}

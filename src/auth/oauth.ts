/**
 * OAuth2 authentication flow
 */

import { randomBytes } from 'node:crypto';
import open from 'open';
import {
  saveTokens,
  loadTokens,
  deleteTokens,
  hasTokens,
  isTokenExpired,
  refreshAccessToken,
  getTokenDir,
} from './tokens.js';
import { startCallbackServer, getCallbackUrl } from './server.js';
import { AuthError } from '../utils/errors.js';
import type { OAuthTokens, AuthStatus } from '../types/whoop.js';

const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

const SCOPES = [
  'read:profile',
  'read:body_measurement',
  'read:recovery',
  'read:sleep',
  'read:workout',
  'read:cycles',
  'offline', // Required to get refresh_token
].join(' ');

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Build the authorization URL
 */
function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    // Provide helpful error messages for common issues
    if (error.includes('redirect_uri') || error.includes('redirect')) {
      throw new AuthError(
        `Redirect URI mismatch. Make sure your WHOOP developer app has:\n` +
          `  Redirect URI: http://localhost:3000/callback\n\n` +
          `To fix: Go to https://developer.whoop.com → Your App → Edit → Update Redirect URI`
      );
    }

    if (error.includes('invalid_client') || error.includes('client_id')) {
      throw new AuthError(
        `Invalid client credentials. Check your WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET.\n\n` +
          `To get credentials: https://developer.whoop.com → Create/Edit App`
      );
    }

    if (error.includes('invalid_grant') || error.includes('expired')) {
      throw new AuthError(
        `Authorization code expired or already used. Please try again:\n` +
          `  whoop auth login`
      );
    }

    throw new AuthError(`Failed to exchange code: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Start the OAuth login flow
 */
export async function login(): Promise<void> {
  const clientId = process.env['WHOOP_CLIENT_ID'];
  const clientSecret = process.env['WHOOP_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new AuthError(
      'WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables are required.\n\n' +
        'Quick setup:\n' +
        '  1. Run: whoop init\n' +
        '  2. Follow the prompts to configure credentials\n\n' +
        'Or manually:\n' +
        '  1. Go to https://developer.whoop.com\n' +
        '  2. Create an app with Redirect URI: http://localhost:3000/callback\n' +
        '  3. Set environment variables:\n' +
        '     export WHOOP_CLIENT_ID="your-client-id"\n' +
        '     export WHOOP_CLIENT_SECRET="your-client-secret"'
    );
  }

  const redirectUri = getCallbackUrl();
  const state = generateState();

  // Build auth URL
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  // Start callback server before opening browser
  console.error('Starting OAuth flow...');
  console.error(`Callback URL: ${redirectUri}`);

  const callbackPromise = startCallbackServer(state);

  // Open browser
  console.error('Opening browser for authorization...');
  await open(authUrl);

  // Wait for callback
  console.error('Waiting for authorization...');
  const { code } = await callbackPromise;

  // Exchange code for tokens
  console.error('Exchanging code for tokens...');
  const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);

  // Save tokens (encrypted)
  saveTokens(tokens);

  console.error('✅ Successfully authenticated!');
  console.error(`Tokens stored in: ${getTokenDir()}`);
}

/**
 * Start the OAuth login flow in headless mode (no browser)
 * User manually opens URL and pastes callback
 */
export async function loginHeadless(): Promise<void> {
  const clientId = process.env['WHOOP_CLIENT_ID'];
  const clientSecret = process.env['WHOOP_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new AuthError(
      'WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables are required.\n\n' +
        'Quick setup:\n' +
        '  1. Run: whoop init\n' +
        '  2. Follow the prompts to configure credentials\n\n' +
        'Or manually:\n' +
        '  1. Go to https://developer.whoop.com\n' +
        '  2. Create an app with Redirect URI: http://localhost:3000/callback\n' +
        '  3. Set environment variables:\n' +
        '     export WHOOP_CLIENT_ID="your-client-id"\n' +
        '     export WHOOP_CLIENT_SECRET="your-client-secret"'
    );
  }

  const redirectUri = getCallbackUrl();
  const state = generateState();

  // Build auth URL
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  console.error('');
  console.error('🔐 Headless OAuth Flow');
  console.error('━'.repeat(50));
  console.error('');
  console.error('1. Open this URL in your browser:');
  console.error('');
  console.error(`   ${authUrl}`);
  console.error('');
  console.error('2. Log in and authorize the app');
  console.error('');
  console.error('3. After authorization, you\'ll be redirected to a URL like:');
  console.error('   http://localhost:3000/callback?code=xxx&state=xxx');
  console.error('');
  console.error('4. Copy and paste that FULL URL below:');
  console.error('');

  // Read URL from stdin
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const callbackUrl = await new Promise<string>((resolve) => {
    rl.question('Callback URL: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // Parse the callback URL
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw new AuthError('Invalid URL. Please paste the full callback URL including http://');
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!code) {
    throw new AuthError('No authorization code found in URL. Did authorization fail?');
  }

  if (returnedState !== state) {
    throw new AuthError('State mismatch. This could be a security issue. Please try again.');
  }

  // Exchange code for tokens
  console.error('');
  console.error('Exchanging code for tokens...');
  const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);

  // Save tokens (encrypted)
  saveTokens(tokens);

  console.error('✅ Successfully authenticated!');
  console.error(`Tokens stored in: ${getTokenDir()}`);
}

/**
 * Log out (delete stored tokens)
 */
export function logout(): void {
  if (!hasTokens()) {
    console.error('No stored tokens found.');
    return;
  }

  deleteTokens();
  console.error('✅ Logged out. Tokens deleted.');
}

/**
 * Get authentication status
 */
export function status(): AuthStatus {
  const tokens = loadTokens();

  if (!tokens) {
    console.error('❌ Not authenticated');
    console.error('Run: whoop auth login');
    return { authenticated: false };
  }

  const expired = isTokenExpired(tokens);
  const expiresAt = new Date(tokens.expires_at).toISOString();

  if (expired) {
    console.error('⚠️  Access token expired (will auto-refresh on next request)');
  } else {
    console.error('✅ Authenticated');
  }

  console.error(`Expires: ${expiresAt}`);
  console.error(`Scopes: ${tokens.scope}`);
  console.error(`Token dir: ${getTokenDir()}`);

  return {
    authenticated: true,
    expires_at: expiresAt,
    scopes: tokens.scope.split(' '),
  };
}

/**
 * Manually refresh the access token
 */
export async function refresh(): Promise<void> {
  const tokens = loadTokens();

  if (!tokens) {
    throw new AuthError('Not authenticated. Run: whoop auth login');
  }

  console.error('Refreshing access token...');
  await refreshAccessToken(tokens);
  console.error('✅ Token refreshed successfully.');
}

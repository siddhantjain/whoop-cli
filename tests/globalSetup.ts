/**
 * Global setup for CLI integration tests
 * Starts a mock API server before all tests run
 */

import { createServer, type Server } from 'node:http';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { encrypt } from '../src/utils/crypto.js';
import type { OAuthTokens } from '../src/types/whoop.js';

let mockServer: Server;
let mockTokenDir: string;

function createMockResponse(url: string): string {
  const urlObj = new URL(url, 'http://localhost');
  const start = urlObj.searchParams.get('start');
  const date = start ? start.split('T')[0] : '2026-01-01';

  if (url.includes('/v2/user/profile/basic')) {
    return JSON.stringify({ user_id: 123456, email: 'test@example.com', first_name: 'Test', last_name: 'User' });
  } else if (url.includes('/v2/user/measurement/body')) {
    return JSON.stringify({ height_meter: 1.78, weight_kilogram: 75, max_heart_rate: 185 });
  } else if (url.includes('/v2/activity/sleep')) {
    return JSON.stringify({
      records: [{ id: 12345, start: `${date}T00:00:00.000Z`, end: `${date}T08:00:00.000Z`, score: { sleep_performance_percentage: 85 } }],
      next_token: null,
    });
  } else if (url.includes('/v2/recovery')) {
    return JSON.stringify({ records: [{ cycle_id: 67890, score: { recovery_score: 72 } }], next_token: null });
  } else if (url.includes('/v2/cycle')) {
    return JSON.stringify({ records: [{ id: 67890, start: `${date}T04:00:00.000Z`, score: { strain: 8.5 } }], next_token: null });
  } else if (url.includes('/v2/activity/workout')) {
    return JSON.stringify({ records: [], next_token: null });
  }
  return JSON.stringify({ error: 'Not found' });
}

export async function setup() {
  // Create mock tokens
  mockTokenDir = join(tmpdir(), `whoop-cli-test-${Date.now()}`);
  mkdirSync(mockTokenDir, { recursive: true, mode: 0o700 });

  const mockTokens: OAuthTokens = {
    access_token: 'mock_test_access_token_12345',
    refresh_token: 'mock_test_refresh_token_67890',
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
    token_type: 'Bearer',
    scope: 'read:recovery read:sleep read:workout read:cycle read:profile read:body',
  };

  const encrypted = encrypt(JSON.stringify(mockTokens));
  writeFileSync(join(mockTokenDir, 'tokens.json'), JSON.stringify(encrypted, null, 2), { mode: 0o600 });

  // Start mock server
  await new Promise<void>((resolve) => {
    mockServer = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(createMockResponse(req.url ?? '/'));
    });

    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address();
      if (typeof addr === 'object' && addr !== null) {
        process.env['WHOOP_API_URL'] = `http://127.0.0.1:${addr.port}/developer`;
        process.env['WHOOP_TOKEN_PATH'] = mockTokenDir;
      }
      resolve();
    });
  });

  // Return cleanup function
  return async () => {
    if (mockServer) {
      mockServer.close();
    }
    if (mockTokenDir && existsSync(mockTokenDir)) {
      rmSync(mockTokenDir, { recursive: true, force: true });
    }
  };
}

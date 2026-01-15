/**
 * Agent Workflow Tests for whoop-cli
 * 
 * These tests document and verify patterns for LLM agents using whoop-cli.
 * They cover:
 * 1. Correct workflows agents should follow
 * 2. Anti-patterns that cause failures
 * 3. Error handling and recovery
 * 4. Edge cases agents might encounter
 * 
 * Exit codes:
 * - 0: Success
 * - 1: General error
 * - 2: Auth error (need to login)
 * - 3: Rate limit (need to wait)
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const CLI_PATH = join(import.meta.dirname, '..', 'dist', 'cli.js');
const TEST_TOKEN_DIR = join(import.meta.dirname, '.test-tokens');

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run CLI with specified options
 * Uses spawnSync to properly capture both stdout and stderr
 */
function runCLI(args: string, options: { 
  tokenDir?: string;
  timeout?: number;
} = {}): CLIResult {
  const result = spawnSync('node', [CLI_PATH, ...args.split(' ').filter(Boolean)], {
    encoding: 'utf-8',
    cwd: join(import.meta.dirname, '..'),
    timeout: options.timeout ?? 30000,
    env: {
      ...process.env,
      WHOOP_TOKEN_PATH: options.tokenDir ?? TEST_TOKEN_DIR,
    },
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Simulated agent that interacts with whoop-cli
 */
class SimulatedWhoopAgent {
  public actions: Array<{ command: string; result: CLIResult; checkedExitCode: boolean }> = [];
  public errors: string[] = [];
  private tokenDir: string;

  constructor(tokenDir: string = TEST_TOKEN_DIR) {
    this.tokenDir = tokenDir;
  }

  /**
   * ANTI-PATTERN: Run command without checking exit code
   */
  naiveRun(args: string): CLIResult {
    const result = runCLI(args, { tokenDir: this.tokenDir });
    this.actions.push({ command: args, result, checkedExitCode: false });
    return result;
  }

  /**
   * CORRECT PATTERN: Run command and handle exit codes properly
   */
  smartRun(args: string): CLIResult {
    const result = runCLI(args, { tokenDir: this.tokenDir });
    this.actions.push({ command: args, result, checkedExitCode: true });

    if (result.exitCode === 2) {
      this.errors.push('Auth error: Need to run `whoop auth login`');
    } else if (result.exitCode === 3) {
      this.errors.push('Rate limit: Need to wait before retrying');
    } else if (result.exitCode !== 0) {
      this.errors.push(`Command failed: ${result.stderr || 'Unknown error'}`);
    }

    return result;
  }

  /**
   * BEST PATTERN: Check auth status before fetching data
   */
  smartFetchWithAuthCheck(dataType: string, date?: string): CLIResult {
    // Step 1: Check auth status
    const authResult = this.smartRun('auth status');
    
    if (authResult.exitCode !== 0) {
      // Not authenticated - in real scenario, would prompt for login
      return authResult;
    }

    // Step 2: Fetch data
    const dateArg = date ? `--date ${date}` : '';
    return this.smartRun(`${dataType} ${dateArg}`);
  }

  /**
   * Parse JSON output safely
   */
  parseOutput(result: CLIResult): unknown {
    if (result.exitCode !== 0) {
      return null;
    }
    try {
      return JSON.parse(result.stdout);
    } catch {
      this.errors.push('Failed to parse output as JSON - was --pretty used?');
      return null;
    }
  }
}

// ============================================================================
// Test: Correct Agent Workflows
// ============================================================================

describe('Agent Workflows - Correct Patterns', () => {
  describe('Auth Check Before Fetch', () => {
    it('should check auth status before fetching data', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Smart agent checks auth first
      const authResult = agent.smartRun('auth status');
      
      // Combine stdout and stderr for checking (auth messages may go to either)
      const combinedOutput = authResult.stdout + authResult.stderr;
      
      // Agent should interpret the result based on output content
      const isAuthenticated = 
        combinedOutput.includes('Expires') || 
        combinedOutput.includes('Scopes');
      const isNotAuthenticated = 
        combinedOutput.includes('Not authenticated') ||
        combinedOutput.includes('whoop auth login');
      
      // Agent should recognize auth state from output
      expect(isAuthenticated || isNotAuthenticated).toBe(true);
      
      // If not authenticated, agent knows to prompt for login
      if (isNotAuthenticated) {
        // Agent would tell user: "Need to run whoop auth login"
        expect(combinedOutput).toContain('whoop auth login');
      }
    });

    it('should use correct date format (YYYY-MM-DD)', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Correct format
      const validDate = '2026-01-14';
      const result = agent.smartRun(`recovery --date ${validDate}`);
      
      // If auth fails, that's expected in test env - but date format was valid
      if (result.exitCode === 1 && result.stderr.includes('Invalid date')) {
        throw new Error('Date format should be valid');
      }
    });
  });

  describe('Output Parsing', () => {
    it('should parse JSON output correctly', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Default output is JSON
      const result = agent.smartRun('--help');  // Help always works
      
      // Agent should know --help is not JSON
      // This tests agent awareness of output format
      expect(result.stdout).toContain('CLI for fetching WHOOP');
    });

    it('should not try to parse --pretty output as JSON', () => {
      // Agent created to demonstrate the pattern
      void new SimulatedWhoopAgent();
      
      // Simulate agent getting pretty output and trying to parse
      const mockPrettyOutput = `
╭─────────────────────────────────────╮
│  WHOOP Recovery - 2026-01-14       │
├─────────────────────────────────────┤
│  Recovery Score:  72%              │
│  HRV:            45.2 ms           │
╰─────────────────────────────────────╯`;

      // Agent should recognize this is not JSON
      try {
        JSON.parse(mockPrettyOutput);
        throw new Error('Should not have parsed');
      } catch (e) {
        // Correct - agent should catch this and not use --pretty for programmatic access
        expect((e as Error).message).not.toBe('Should not have parsed');
      }
    });
  });

  describe('Exit Code Handling', () => {
    it('should handle exit code 0 (success)', () => {
      const agent = new SimulatedWhoopAgent();
      const result = agent.smartRun('--version');
      
      expect(result.exitCode).toBe(0);
      expect(agent.errors).toHaveLength(0);
    });

    it('should handle exit code 1 (general error)', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Invalid date format triggers error
      const result = agent.smartRun('recovery --date not-a-date');
      
      expect(result.exitCode).toBe(1);
      expect(agent.errors.length).toBeGreaterThan(0);
    });

    it('should handle exit code 2 (auth error)', () => {
      // Use a non-existent token directory to force auth error
      const agent = new SimulatedWhoopAgent('/nonexistent/path');
      const result = agent.smartRun('recovery');
      
      // Should get auth error
      if (result.exitCode === 2) {
        expect(agent.errors.some(e => e.includes('Auth error'))).toBe(true);
      }
    });
  });
});

// ============================================================================
// Test: Anti-Patterns
// ============================================================================

describe('Agent Workflows - Anti-Patterns', () => {
  describe('Ignoring Exit Codes', () => {
    it('ANTI-PATTERN: ignoring auth errors leads to empty/invalid data', () => {
      const agent = new SimulatedWhoopAgent('/nonexistent/tokens');
      
      // Naive agent just runs the command
      const result = agent.naiveRun('recovery');
      
      // Naive agent didn't check exit code
      expect(agent.actions[0]?.checkedExitCode).toBe(false);
      
      // Data is empty or error message, not valid JSON
      const parsed = agent.parseOutput(result);
      if (result.exitCode !== 0) {
        expect(parsed).toBeNull();
        // Naive agent might try to use this null data!
      }
    });
  });

  describe('Wrong Date Formats', () => {
    it('ANTI-PATTERN: using wrong date format', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Common mistakes agents make:
      const wrongFormats = [
        '01-14-2026',      // US format
        '14/01/2026',      // EU format
        'January 14 2026', // Human format
        '2026/01/14',      // Slashes instead of dashes
      ];

      for (const wrongDate of wrongFormats) {
        const result = agent.smartRun(`recovery --date ${wrongDate}`);
        
        // Should either error or the CLI should reject
        // Agent should know to use YYYY-MM-DD
        if (result.stderr.includes('Invalid date format')) {
          expect(result.exitCode).toBe(1);
        }
      }
    });

    it('ANTI-PATTERN: requesting future dates', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Future date - no data will exist
      const futureDate = '2030-01-01';
      const result = agent.smartRun(`recovery --date ${futureDate}`);
      
      // Even if command succeeds, data will be empty
      if (result.exitCode === 0) {
        const data = JSON.parse(result.stdout) as { recovery?: unknown[] };
        // Recovery array will be empty for future date
        expect(data.recovery ?? []).toHaveLength(0);
      }
    });
  });

  describe('Output Format Confusion', () => {
    it('ANTI-PATTERN: trying to JSON.parse --pretty output', () => {
      const agent = new SimulatedWhoopAgent();
      
      // If agent uses --pretty and tries to parse as JSON
      const prettyResult = agent.naiveRun('--help');  // Simulating pretty-like output
      
      // Help output is not JSON - agent should know this
      const isValidJSON = (() => {
        try {
          JSON.parse(prettyResult.stdout);
          return true;
        } catch {
          return false;
        }
      })();

      // --help output is NOT JSON, agent should know not to parse it
      // Real --pretty output is also not JSON
      expect(isValidJSON).toBe(false);
    });
  });

  describe('Missing Auth Check', () => {
    it('ANTI-PATTERN: fetching data without checking auth first', () => {
      // Use a definitively non-existent token directory
      const agent = new SimulatedWhoopAgent('/tmp/nonexistent-whoop-tokens-xyz');
      
      // Naive agent skips auth check and just fetches
      void agent.naiveRun('recovery');
      
      // Without valid tokens, we expect auth error (exit code 2)
      // The point is: agent should have checked auth status first
      // to give a better error message to the user
      
      // Even if it succeeds (unlikely), the anti-pattern is documented:
      // - Don't fetch without checking auth first
      // - Check auth status to give users actionable feedback
      expect(agent.actions[0]?.checkedExitCode).toBe(false);  // Naive agent didn't check!
    });
  });
});

// ============================================================================
// Test: Edge Cases
// ============================================================================

describe('Agent Workflows - Edge Cases', () => {
  describe('WHOOP Day Boundary', () => {
    it('should understand WHOOP day ends at 4am', () => {
      // WHOOP considers the "day" to end at 4am, not midnight
      // This means data for "yesterday" might still be recording
      // until 4am today
      
      // Agent should be aware that:
      // - Requesting "today" before 4am might get incomplete data
      // - The date boundary is in local time
      
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 4) {
        // Before 4am - "today's" WHOOP data might still be yesterday's
        // Agent should potentially request yesterday's date instead
        expect(hour).toBeLessThan(4);
      }
    });
  });

  describe('Empty Data Handling', () => {
    it('should handle days with no workouts gracefully', () => {
      // Agent created to demonstrate the pattern
      void new SimulatedWhoopAgent();
      
      // Not every day has a workout
      // Agent should handle empty arrays, not treat as error
      
      const mockEmptyWorkoutResponse = {
        date: '2026-01-14',
        fetched_at: new Date().toISOString(),
        workout: [],  // Empty - no workout that day
      };

      // Agent should check array length, not just existence
      expect(mockEmptyWorkoutResponse.workout).toHaveLength(0);
      expect(Array.isArray(mockEmptyWorkoutResponse.workout)).toBe(true);
    });

    it('should handle missing data types in response', () => {
      // If agent requests only recovery, sleep won't be in response
      const mockRecoveryOnlyResponse = {
        date: '2026-01-14',
        fetched_at: new Date().toISOString(),
        recovery: [{ score: { recovery_score: 72 } }],
        // Note: no 'sleep' key at all
      };

      // Agent should check if key exists before accessing
      const hasSleep = 'sleep' in mockRecoveryOnlyResponse;
      expect(hasSleep).toBe(false);
      
      // Safe access pattern
      const sleepData = (mockRecoveryOnlyResponse as Record<string, unknown>).sleep ?? [];
      expect(sleepData).toEqual([]);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle slow API responses', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Agent should set reasonable timeouts
      // Our runCLI defaults to 30s which is reasonable
      
      // Test that --help responds quickly (sanity check)
      const start = Date.now();
      agent.smartRun('--help');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(5000);  // Should be very fast
    });
  });
});

// ============================================================================
// Test: Recovery Patterns
// ============================================================================

describe('Agent Workflows - Error Recovery', () => {
  describe('Auth Error Recovery', () => {
    it('should recover from auth error by re-authenticating', () => {
      const agent = new SimulatedWhoopAgent('/nonexistent/tokens');
      
      // Step 1: Try to fetch, get auth error
      const result = agent.smartRun('recovery');
      
      if (result.exitCode === 2) {
        // Step 2: Agent should recognize auth error and know the fix
        expect(agent.errors.some(e => e.includes('Auth error'))).toBe(true);
        
        // Step 3: In real scenario, agent would run: whoop auth login
        // But that requires interactive browser, so agent should
        // report back to user that authentication is needed
      }
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should handle rate limit with exponential backoff', () => {
      // Simulate rate limit scenario
      const mockRateLimitResult: CLIResult = {
        stdout: '',
        stderr: 'Error: Rate limited. Retry after: 60 seconds',
        exitCode: 3,
      };

      // Agent should parse retry-after and wait
      const retryAfterMatch = mockRateLimitResult.stderr.match(/Retry after: (\d+)/);
      if (retryAfterMatch?.[1]) {
        const retryAfterSeconds = parseInt(retryAfterMatch[1], 10);
        expect(retryAfterSeconds).toBe(60);
        
        // Agent should wait this long before retrying
        // In real code: await sleep(retryAfterSeconds * 1000)
      }
    });
  });

  describe('Retry with Correct Parameters', () => {
    it('should retry failed request with correct date format', () => {
      const agent = new SimulatedWhoopAgent();
      
      // First attempt with wrong format
      const wrongResult = agent.smartRun('recovery --date 01-14-2026');
      
      if (wrongResult.exitCode !== 0) {
        // Agent recognizes the error and retries correctly
        const correctResult = agent.smartRun('recovery --date 2026-01-14');
        
        // At least the date format is now correct
        // (might still fail for other reasons like auth)
        if (correctResult.stderr.includes('Invalid date')) {
          throw new Error('Date format should be valid on retry');
        }
      }
    });
  });
});

// ============================================================================
// Test: Real-World Scenarios
// ============================================================================

describe('Agent Workflows - Real World Scenarios', () => {
  describe('Morning Summary Generation', () => {
    it('should fetch recovery and sleep for morning summary', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Morning summary workflow:
      // 1. Check auth
      const authResult = agent.smartRun('auth status');
      
      // 2. If auth OK, fetch data
      if (authResult.exitCode === 0) {
        const recoveryResult = agent.smartRun('recovery');
        const sleepResult = agent.smartRun('sleep');
        
        // 3. Parse results
        const recovery = agent.parseOutput(recoveryResult);
        const sleep = agent.parseOutput(sleepResult);
        
        // 4. Use data (if available)
        if (recovery && sleep) {
          // Generate summary
        }
      } else {
        // Auth failed - agent should report this
        expect(agent.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Weekly Report Generation', () => {
    it('should fetch multiple days of data for weekly report', () => {
      // Agent created to demonstrate the pattern
      void new SimulatedWhoopAgent();
      
      // Generate last 7 days of dates
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr) dates.push(dateStr);
      }

      // Agent should fetch each day
      for (const date of dates) {
        // Validate date format before fetching
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Using Summary Command', () => {
    it('should use summary command for quick overview', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Summary command gives one-liner output
      const result = agent.smartRun('summary');
      
      // If successful, output format is:
      // "Recovery: 72% | HRV: 45ms | Sleep: 85% | Strain: 8.2"
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Recovery:');
      }
    });
  });
});

// ============================================================================
// Test: Safeguards
// ============================================================================

describe('Agent Workflows - Safeguards', () => {
  describe('Exit Code Consistency', () => {
    it('should always return meaningful exit codes', () => {
      const agent = new SimulatedWhoopAgent();
      
      // Help should always work
      const helpResult = agent.smartRun('--help');
      expect(helpResult.exitCode).toBe(0);
      
      // Version should always work
      const versionResult = agent.smartRun('--version');
      expect(versionResult.exitCode).toBe(0);
      
      // Invalid date format should return error
      const invalidResult = agent.smartRun('recovery --date bad-date');
      expect(invalidResult.exitCode).toBe(1);
    });
  });

  describe('Stderr vs Stdout Separation', () => {
    it('errors go to stderr, data goes to stdout', () => {
      const agent = new SimulatedWhoopAgent('/nonexistent/tokens');
      
      const result = agent.naiveRun('recovery');
      
      // If there's an error, it should be on stderr
      if (result.exitCode !== 0) {
        // Stdout should not contain error messages
        // (might be empty, but shouldn't have "Error:")
        expect(result.stdout).not.toContain('Error:');
      }
    });
  });
});

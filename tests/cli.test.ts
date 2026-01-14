import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CLI_PATH = join(import.meta.dirname, '..', 'dist', 'cli.js');

/**
 * Helper to run the CLI with test environment
 */
function runCLI(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      cwd: join(import.meta.dirname, '..'),
      timeout: 30000,
      env: {
        ...process.env,
        // WHOOP_API_URL and WHOOP_TOKEN_PATH are set by globalSetup
      },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

describe('CLI', () => {
  describe('--help', () => {
    it('shows help text', () => {
      const { stdout } = runCLI('--help');
      expect(stdout).toContain('CLI for fetching WHOOP health data');
      expect(stdout).toContain('sleep');
      expect(stdout).toContain('recovery');
    });
  });

  describe('--version', () => {
    it('shows version', () => {
      const { stdout } = runCLI('--version');
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('subcommand --date option', () => {
    // This test verifies the fix for the --date option bug where
    // subcommand options were being shadowed by global options.
    // The bug was that `whoop sleep --date 2026-01-06` would return
    // today's data instead of data for the specified date.

    it('sleep subcommand respects --date option', () => {
      const { stdout, exitCode } = runCLI('sleep --date 2026-01-06');

      // Should succeed
      expect(exitCode).toBe(0);

      // Parse output
      const data = JSON.parse(stdout);

      // The output should show the requested date, not today's date
      expect(data.date).toBe('2026-01-06');

      // If there's sleep data, it should be from the requested date
      if (data.sleep && data.sleep.length > 0) {
        const sleepStart = data.sleep[0].start as string;
        const sleepDate = sleepStart.split('T')[0];
        expect(sleepDate).toBe('2026-01-06');
      }
    });

    it('recovery subcommand respects --date option', () => {
      const { stdout, exitCode } = runCLI('recovery --date 2026-01-06');

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(data.date).toBe('2026-01-06');
    });

    it('cycle subcommand respects --date option', () => {
      const { stdout, exitCode } = runCLI('cycle --date 2026-01-06');

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(data.date).toBe('2026-01-06');
    });

    it('combined flags respect --date option', () => {
      const { stdout, exitCode } = runCLI('--sleep --recovery --date 2026-01-06');

      expect(exitCode).toBe(0);

      const data = JSON.parse(stdout);
      expect(data.date).toBe('2026-01-06');
    });
  });

  describe('invalid date handling', () => {
    it('rejects invalid date format', () => {
      const { stderr, exitCode } = runCLI('sleep --date invalid');

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Invalid date format');
    });

    it('rejects incorrect date format', () => {
      const { stderr, exitCode } = runCLI('sleep --date 01-06-2026');

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Invalid date format');
    });
  });
});

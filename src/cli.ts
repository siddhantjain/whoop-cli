#!/usr/bin/env node
/**
 * WHOOP CLI - Command Line Interface
 */

import { Command } from 'commander';
import { login, logout, status as authStatus, refresh as authRefresh } from './auth/oauth.js';
import { fetchData } from './api/client.js';
import { getWhoopDay, validateISODate } from './utils/date.js';
import { handleError, WhoopError, ExitCode } from './utils/errors.js';
import { formatPretty, formatSummary } from './utils/format.js';
import type { DataType, CombinedOutput } from './types/whoop.js';

const program = new Command();

/**
 * Output data in JSON or pretty format
 */
function output(data: CombinedOutput, pretty: boolean): void {
  // Using console.log for stdout (data output)
  // eslint-disable-next-line no-console
  console.log(pretty ? formatPretty(data) : JSON.stringify(data, null, 2));
}

// ============================================================================
// Program Setup
// ============================================================================

program.name('whoop').description('CLI for fetching WHOOP health data').version('0.1.0');

// ============================================================================
// Auth Commands
// ============================================================================

program
  .command('auth')
  .description('Manage authentication')
  .argument('<action>', 'login, logout, status, or refresh')
  .action(async (action: string) => {
    try {
      switch (action) {
        case 'login':
          await login();
          break;
        case 'logout':
          logout();
          break;
        case 'status':
          authStatus();
          break;
        case 'refresh':
          await authRefresh();
          break;
        default:
          throw new WhoopError(
            `Unknown auth action: ${action}. Use: login, logout, status, or refresh`,
            ExitCode.GENERAL_ERROR
          );
      }
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Data Commands
// ============================================================================

/**
 * Helper to create data subcommands
 */
function addDataCommand(name: string, description: string, dataType: DataType): void {
  program
    .command(name)
    .description(description)
    .option('-d, --date <date>', 'Date in ISO format (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Max results per page', '25')
    .option('-a, --all', 'Fetch all pages')
    .option('-p, --pretty', 'Human-readable output')
    .action(async (options: { date?: string; limit: string; all?: boolean; pretty?: boolean }) => {
      try {
        const date = options.date ?? getWhoopDay();

        if (options.date && !validateISODate(options.date)) {
          throw new WhoopError('Invalid date format. Use YYYY-MM-DD', ExitCode.GENERAL_ERROR);
        }

        const result = await fetchData([dataType], date, {
          limit: parseInt(options.limit, 10),
          all: options.all,
        });

        output(result, options.pretty ?? false);
      } catch (error) {
        handleError(error);
      }
    });
}

addDataCommand('profile', 'Fetch user profile', 'profile');
addDataCommand('body', 'Fetch body measurements', 'body');
addDataCommand('sleep', 'Fetch sleep data', 'sleep');
addDataCommand('recovery', 'Fetch recovery data', 'recovery');
addDataCommand('workout', 'Fetch workout data', 'workout');
addDataCommand('cycle', 'Fetch cycle (daily strain) data', 'cycle');

// ============================================================================
// Summary Command
// ============================================================================

program
  .command('summary')
  .description('One-line health summary')
  .option('-d, --date <date>', 'Date in ISO format (YYYY-MM-DD)')
  .action(async (options: { date?: string }) => {
    try {
      const date = options.date ?? getWhoopDay();

      if (options.date && !validateISODate(options.date)) {
        throw new WhoopError('Invalid date format. Use YYYY-MM-DD', ExitCode.GENERAL_ERROR);
      }

      const result = await fetchData(['recovery', 'sleep', 'cycle'], date);

      // eslint-disable-next-line no-console
      console.log(formatSummary(result));
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Default Command (combined data)
// ============================================================================

program
  .option('-d, --date <date>', 'Date in ISO format (YYYY-MM-DD)')
  .option('-l, --limit <number>', 'Max results per page', '25')
  .option('-a, --all', 'Fetch all pages')
  .option('-p, --pretty', 'Human-readable output')
  .option('--sleep', 'Include sleep data')
  .option('--recovery', 'Include recovery data')
  .option('--workout', 'Include workout data')
  .option('--cycle', 'Include cycle data')
  .option('--profile', 'Include profile data')
  .option('--body', 'Include body measurements')
  .action(
    async (options: {
      date?: string;
      limit: string;
      all?: boolean;
      pretty?: boolean;
      sleep?: boolean;
      recovery?: boolean;
      workout?: boolean;
      cycle?: boolean;
      profile?: boolean;
      body?: boolean;
    }) => {
      try {
        // Collect requested data types
        const types: DataType[] = [];
        if (options.sleep) types.push('sleep');
        if (options.recovery) types.push('recovery');
        if (options.workout) types.push('workout');
        if (options.cycle) types.push('cycle');
        if (options.profile) types.push('profile');
        if (options.body) types.push('body');

        // If no types specified, show help
        if (types.length === 0) {
          program.help();
          return;
        }

        const date = options.date ?? getWhoopDay();

        if (options.date && !validateISODate(options.date)) {
          throw new WhoopError('Invalid date format. Use YYYY-MM-DD', ExitCode.GENERAL_ERROR);
        }

        const result = await fetchData(types, date, {
          limit: parseInt(options.limit, 10),
          all: options.all,
        });

        output(result, options.pretty ?? false);
      } catch (error) {
        handleError(error);
      }
    }
  );

// ============================================================================
// Parse and Run
// ============================================================================

program.parse();

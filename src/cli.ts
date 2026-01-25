#!/usr/bin/env node
/**
 * WHOOP CLI - Command Line Interface
 */

import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { login, logout, status as authStatus, refresh as authRefresh } from './auth/oauth.js';
import {
  fetchData,
  fetchDataRange,
  getSleepById,
  getWorkoutById,
  getCycleById,
  getRecoveryByCycleId,
} from './api/client.js';
import { getWhoopDay, validateISODate } from './utils/date.js';
import { handleError, WhoopError, ExitCode } from './utils/errors.js';
import { formatPretty, formatSummary, formatCSV } from './utils/format.js';
import {
  checkWake,
  formatWakeResult,
  loadHistory,
  addToHistory,
  parseSleepRecord,
} from './utils/wake.js';
import type { DataType, CombinedOutput } from './types/whoop.js';

const program = new Command();

type OutputFormat = 'json' | 'pretty' | 'csv';

/**
 * Output data in specified format, optionally to a file
 */
function output(
  data: CombinedOutput,
  format: OutputFormat,
  outputPath?: string,
  dataType?: string
): void {
  let content: string;

  switch (format) {
    case 'pretty':
      content = formatPretty(data);
      break;
    case 'csv':
      content = formatCSV(data, dataType);
      break;
    case 'json':
    default:
      content = JSON.stringify(data, null, 2);
      break;
  }

  if (outputPath) {
    writeFileSync(outputPath, content + '\n', 'utf-8');
    console.error(`Data written to ${outputPath}`);
  } else {
    // Using console.log for stdout (data output)
    // eslint-disable-next-line no-console
    console.log(content);
  }
}

// ============================================================================
// Program Setup
// ============================================================================

program
  .name('whoop')
  .description('CLI for fetching WHOOP health data')
  .version('0.1.0')
  .enablePositionalOptions();

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
    .option('-s, --start <date>', 'Start date for range query (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date for range query (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Max results per page', '25')
    .option('-a, --all', 'Fetch all pages')
    .option('-p, --pretty', 'Human-readable output')
    .option('--progress', 'Show progress for paginated fetches')
    .option('-q, --quiet', 'Suppress progress output')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-f, --format <format>', 'Output format: json, csv, or pretty', 'json')
    .action(
      async (options: {
        date?: string;
        start?: string;
        end?: string;
        limit: string;
        all?: boolean;
        pretty?: boolean;
        progress?: boolean;
        quiet?: boolean;
        output?: string;
        format?: string;
      }) => {
        try {
          // Validate options: can't use --date with --start/--end
          if (options.date && (options.start || options.end)) {
            throw new WhoopError(
              'Cannot use --date with --start/--end. Use either --date OR --start/--end.',
              ExitCode.GENERAL_ERROR
            );
          }

          // If using date range
          if (options.start || options.end) {
            if (!options.start || !options.end) {
              throw new WhoopError(
                'Both --start and --end are required for range queries.',
                ExitCode.GENERAL_ERROR
              );
            }

            if (!validateISODate(options.start)) {
              throw new WhoopError(
                `Invalid start date format: ${options.start}. Use YYYY-MM-DD`,
                ExitCode.GENERAL_ERROR
              );
            }

            if (!validateISODate(options.end)) {
              throw new WhoopError(
                `Invalid end date format: ${options.end}. Use YYYY-MM-DD`,
                ExitCode.GENERAL_ERROR
              );
            }

            // Show progress by default for range queries unless --quiet is specified
            const showProgress = options.quiet ? false : (options.progress ?? true);

            const result = await fetchDataRange([dataType], options.start, options.end, {
              limit: parseInt(options.limit, 10),
              all: options.all ?? true, // Default to --all for range queries
              showProgress,
            });

            // Determine format: --pretty flag overrides --format for backwards compatibility
            const format: OutputFormat = options.pretty
              ? 'pretty'
              : (options.format as OutputFormat) ?? 'json';

            output(result, format, options.output, dataType);
            return;
          }

          // Single date query (original behavior)
          const date = options.date ?? getWhoopDay();

          if (options.date && !validateISODate(options.date)) {
            throw new WhoopError('Invalid date format. Use YYYY-MM-DD', ExitCode.GENERAL_ERROR);
          }

          // Show progress if --progress is specified and not --quiet
          const showProgressSingle = options.quiet ? false : options.progress;

          const result = await fetchData([dataType], date, {
            limit: parseInt(options.limit, 10),
            all: options.all,
            showProgress: showProgressSingle,
          });

          // Determine format: --pretty flag overrides --format for backwards compatibility
          const formatSingle: OutputFormat = options.pretty
            ? 'pretty'
            : (options.format as OutputFormat) ?? 'json';

          output(result, formatSingle, options.output, dataType);
        } catch (error) {
          handleError(error);
        }
      }
    );
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
// Get by ID Command
// ============================================================================

program
  .command('get')
  .description('Fetch a specific record by ID')
  .argument('<type>', 'Record type: sleep, workout, cycle, or recovery')
  .argument('<id>', 'Record ID (numeric)')
  .option('-p, --pretty', 'Human-readable output')
  .option('-f, --format <format>', 'Output format: json or csv', 'json')
  .option('-o, --output <file>', 'Write output to file')
  .action(
    async (
      type: string,
      id: string,
      options: { pretty?: boolean; format?: string; output?: string }
    ) => {
      try {
        const recordId = parseInt(id, 10);
        if (isNaN(recordId)) {
          throw new WhoopError(`Invalid ID: ${id}. Must be a number.`, ExitCode.GENERAL_ERROR);
        }

        let result: unknown;

        switch (type.toLowerCase()) {
          case 'sleep':
            result = await getSleepById(recordId);
            break;
          case 'workout':
            result = await getWorkoutById(recordId);
            break;
          case 'cycle':
            result = await getCycleById(recordId);
            break;
          case 'recovery':
            // Recovery is fetched by cycle ID
            result = await getRecoveryByCycleId(recordId);
            break;
          default:
            throw new WhoopError(
              `Unknown record type: ${type}. Use: sleep, workout, cycle, or recovery`,
              ExitCode.GENERAL_ERROR
            );
        }

        // Format output
        const content = options.pretty
          ? JSON.stringify(result, null, 2)
          : JSON.stringify(result, null, 2);

        if (options.output) {
          writeFileSync(options.output, content + '\n', 'utf-8');
          console.error(`Data written to ${options.output}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(content);
        }
      } catch (error) {
        handleError(error);
      }
    }
  );

// ============================================================================
// Wake Detection Command
// ============================================================================

program
  .command('wake')
  .description('Check if user is actually awake (adaptive sleep pattern detection)')
  .option('-p, --pretty', 'Human-readable output')
  .option('--seed', 'Seed history with recent sleep data (run once to initialize)')
  .action(async (options: { pretty?: boolean; seed?: boolean }) => {
    try {
      // If seeding, fetch last 14 days and populate history
      if (options.seed) {
        // eslint-disable-next-line no-console
        console.error('Seeding sleep history with last 14 days...');

        const today = new Date();
        for (let i = 13; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0] as string;

          try {
            const result = await fetchData(['sleep'], dateStr, { limit: 10 });
            const sleeps = result.sleep ?? [];
            // Find primary sleep (not nap)
            const primarySleep = sleeps.find((s: { nap?: boolean }) => !s.nap);
            if (primarySleep) {
              const record = parseSleepRecord(primarySleep);
              if (record) {
                addToHistory(record);
                // eslint-disable-next-line no-console
                console.error(
                  `  ✓ ${dateStr}: ${record.durationHours.toFixed(1)}h, ${record.cycles} cycles`
                );
              }
            }
          } catch {
            // eslint-disable-next-line no-console
            console.error(`  ✗ ${dateStr}: no data`);
          }
        }

        // eslint-disable-next-line no-console
        console.error('Done! History seeded.');

        const history = loadHistory();
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ seeded: true, records: history.length }, null, 2));
        return;
      }

      // Fetch today's sleep
      const date = getWhoopDay();
      const result = await fetchData(['sleep'], date, { limit: 10 });

      const sleeps = result.sleep ?? [];
      if (sleeps.length === 0) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              isAwake: false,
              reason: 'no_sleep_data',
              message: 'No sleep data available yet. User may still be asleep.',
            },
            null,
            2
          )
        );
        return;
      }

      // Find primary sleep (not nap, most recent)
      const primarySleep = sleeps.find((s: { nap?: boolean }) => !s.nap) ?? sleeps[0];

      if (!primarySleep) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify(
            {
              isAwake: false,
              reason: 'no_valid_sleep',
              message: 'No valid sleep data found.',
            },
            null,
            2
          )
        );
        return;
      }

      // Run wake detection
      const wakeResult = checkWake(primarySleep);

      if (options.pretty) {
        // eslint-disable-next-line no-console
        console.log(formatWakeResult(wakeResult));
      } else {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(wakeResult, null, 2));
      }
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

        const outputFormat: OutputFormat = options.pretty ? 'pretty' : 'json';
        output(result, outputFormat);
      } catch (error) {
        handleError(error);
      }
    }
  );

// ============================================================================
// Parse and Run
// ============================================================================

program.parse();

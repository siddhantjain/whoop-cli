---
name: whoop-cli
description: WHOOP CLI for fetching health data (sleep, recovery, HRV, strain, workouts).
homepage: https://github.com/siddhantjain/whoop-cli
metadata: {"emoji":"💪","requires":{"bins":["node"],"env":["WHOOP_CLIENT_ID","WHOOP_CLIENT_SECRET"]},"install":[{"id":"npm","kind":"npm","package":"whoop-cli","bins":["whoop"],"label":"Install whoop-cli (npm)"}]}
---

# whoop-cli

Fetch WHOOP health metrics (sleep, recovery, HRV, strain, workouts) via CLI.

Install: `npm install -g whoop-cli` | [GitHub](https://github.com/siddhantjain/whoop-cli)

## Quick Reference

```bash
# One-liner summary
whoop summary
# → Recovery: 72% | HRV: 45ms | Sleep: 85% | Strain: 8.2

# Today's data (JSON)
whoop recovery
whoop sleep
whoop workout

# Human-readable
whoop --pretty

# Specific date
whoop --date 2026-01-10 --recovery --sleep

# All data types
whoop --recovery --sleep --workout --cycle --profile --body
```

## Commands

| Command | Output |
|---------|--------|
| `whoop summary` | One-line: Recovery, HRV, Sleep %, Strain |
| `whoop recovery` | Recovery score, HRV (ms), RHR, SpO2, skin temp |
| `whoop sleep` | Sleep stages, efficiency, respiratory rate |
| `whoop workout` | Strain score, HR zones, calories, duration |
| `whoop cycle` | Daily strain, calories, kilojoules |
| `whoop profile` | Name, email, user ID |
| `whoop body` | Height, weight, max heart rate |

## Options

| Flag | Description |
|------|-------------|
| `-d, --date <YYYY-MM-DD>` | Specific date (default: today) |
| `-p, --pretty` | Human-readable output |
| `-l, --limit <n>` | Max records |
| `-a, --all` | Fetch all pages |

## Auth

```bash
whoop auth login   # OAuth flow (opens browser)
whoop auth status  # Check if authenticated
whoop auth logout  # Clear tokens
whoop auth refresh # Force token refresh
```

## Output Schema

JSON output structure:
```json
{
  "date": "2026-01-12",
  "fetched_at": "2026-01-12T15:30:00.000Z",
  "recovery": [{
    "cycle_id": 1234,
    "score": {
      "recovery_score": 72,
      "resting_heart_rate": 52,
      "hrv_rmssd_milli": 45.2,
      "spo2_percentage": 96.5,
      "skin_temp_celsius": 33.1
    }
  }],
  "sleep": [{
    "score": {
      "sleep_performance_percentage": 85,
      "respiratory_rate": 14.2,
      "stage_summary": {
        "total_light_sleep_time_milli": 14400000,
        "total_slow_wave_sleep_time_milli": 7200000,
        "total_rem_sleep_time_milli": 5400000
      }
    }
  }]
}
```

## Notes

- Output is JSON by default (pipe-friendly)
- Date uses WHOOP day boundary (ends at 4am)
- Tokens stored encrypted in `~/.whoop-cli/`
- Auto-refreshes expired tokens
- Exit codes: 0=success, 1=error, 2=auth error, 3=rate limit

## Common Patterns

```bash
# Get yesterday's recovery score
whoop recovery --date $(date -d "yesterday" +%Y-%m-%d) | jq '.recovery[0].score.recovery_score'

# Check if user is well-rested (recovery > 66%)
whoop summary | grep -oP 'Recovery: \K\d+' | awk '$1 > 66 {print "Well rested!"}'

# Export week of sleep data
for i in {0..6}; do
  whoop sleep --date $(date -d "$i days ago" +%Y-%m-%d)
done | jq -s '.'
```

## Error Handling

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | - |
| 1 | General error | Check stderr |
| 2 | Auth error | Run `whoop auth login` |
| 3 | Rate limit | Wait and retry |

Errors output to stderr, data to stdout. Safe to parse stdout even on errors.

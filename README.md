# whoop-cli 💪

> CLI for fetching WHOOP health data — designed for humans and AI agents

[![npm version](https://img.shields.io/npm/v/whoop-cli.svg)](https://www.npmjs.com/package/whoop-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://github.com/siddhantjain/whoop-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/siddhantjain/whoop-cli/actions)

A modern, type-safe CLI for the [WHOOP API v2](https://developer.whoop.com/api). Perfect for:
- 🏃 Athletes tracking their recovery and strain
- 🤖 AI agents and LLMs needing structured health data
- 📊 Developers building health integrations
- 🔬 Researchers analyzing fitness metrics

## Features

- ✅ **Official WHOOP API v2** — OAuth2, not unofficial scraping
- ✅ **JSON-first output** — Perfect for piping and LLM consumption
- ✅ **Human-readable mode** — `--pretty` for terminal use
- ✅ **Encrypted token storage** — AES-256 at rest
- ✅ **Auto token refresh** — Seamless authentication
- ✅ **Type-safe** — Full TypeScript with strict mode
- ✅ **Well-tested** — 80%+ coverage requirement
- ✅ **Agent-friendly** — Includes SKILL.md for AI assistants

## Installation

```bash
npm install -g whoop-cli
```

## Quick Start

### 1. Create a WHOOP Developer App

1. Go to [developer.whoop.com](https://developer.whoop.com)
2. Create a new application
3. Set redirect URI to `http://localhost:3000/callback`
4. Note your Client ID and Client Secret

### 2. Configure

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
```

Or create a `.env` file in your working directory.

### 3. Authenticate

```bash
whoop auth login
```

This opens your browser for OAuth. Tokens are stored encrypted in `~/.whoop-cli/`.

### 4. Fetch Data

```bash
# Quick summary
whoop summary
# Output: Recovery: 72% | HRV: 45ms | Sleep: 85% | Strain: 8.2

# Today's recovery
whoop recovery

# Sleep data (JSON)
whoop sleep

# All data, human-readable
whoop --pretty

# Specific date
whoop --date 2026-01-10 --recovery --sleep
```

## Commands

### Data Commands

| Command | Description |
|---------|-------------|
| `whoop summary` | One-line health summary |
| `whoop recovery` | Recovery score, HRV, RHR, SpO2 |
| `whoop sleep` | Sleep stages, efficiency, duration |
| `whoop workout` | Workouts with strain scores |
| `whoop cycle` | Daily physiological cycles |
| `whoop profile` | User profile information |
| `whoop body` | Body measurements (height, weight, max HR) |

### Auth Commands

| Command | Description |
|---------|-------------|
| `whoop auth login` | Start OAuth flow |
| `whoop auth logout` | Clear stored tokens |
| `whoop auth status` | Check authentication status |
| `whoop auth refresh` | Manually refresh tokens |

### Options

| Option | Description |
|--------|-------------|
| `-d, --date <YYYY-MM-DD>` | Fetch data for specific date |
| `-p, --pretty` | Human-readable output |
| `-l, --limit <n>` | Max records per request |
| `-a, --all` | Fetch all pages (pagination) |
| `--json` | Force JSON output (default) |

## Output Formats

### JSON (default)
```json
{
  "date": "2026-01-12",
  "fetched_at": "2026-01-12T15:30:00.000Z",
  "recovery": [{
    "score": { "recovery_score": 72, "hrv_rmssd_milli": 45.2 }
  }]
}
```

### Pretty
```
💪 WHOOP Data for 2026-01-12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔋 Recovery: 72% (Green)
💓 HRV: 45ms | RHR: 52bpm
😴 Sleep: 7h 23m (85% efficiency)
🔥 Strain: 8.2
```

## For AI Agents

This CLI is designed to work seamlessly with AI agents. Include the bundled `SKILL.md` in your agent's context:

```bash
cat $(npm root -g)/whoop-cli/SKILL.md
```

The SKILL.md provides:
- Command reference
- Output schemas
- Common usage patterns
- Error handling guidance

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHOOP_CLIENT_ID` | Yes | OAuth client ID |
| `WHOOP_CLIENT_SECRET` | Yes | OAuth client secret |
| `WHOOP_REDIRECT_URI` | No | Callback URL (default: `http://localhost:3000/callback`) |
| `WHOOP_TOKEN_PATH` | No | Token storage location (default: `~/.whoop-cli/`) |

## Security

- Tokens are encrypted with AES-256-GCM before storage
- Encryption key derived from machine-specific identifiers
- Tokens auto-refresh; you rarely need to re-authenticate
- See [SECURITY.md](SECURITY.md) for details

## Development

```bash
# Clone
git clone https://github.com/siddhantjain/whoop-cli.git
cd whoop-cli

# Install
npm install

# Run in dev mode
npm run dev -- --help

# Test
npm test

# Lint & format
npm run lint
npm run format

# Build
npm run build
```

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT © [Siddhant Jain](https://github.com/siddhantjain)

## Disclaimer

This is an unofficial tool. It uses the official WHOOP API but is not endorsed by or affiliated with WHOOP Inc.

## Acknowledgments

- [WHOOP](https://www.whoop.com) for their excellent API
- [whoopskill](https://github.com/koala73/whoopskill) for CLI patterns
- [whoop-mcp-server](https://github.com/RomanEvstigneev/whoop-mcp-server) for encryption patterns

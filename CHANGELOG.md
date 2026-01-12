# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release
- OAuth2 authentication with WHOOP API v2
- Data fetching: recovery, sleep, workout, cycle, profile, body
- `summary` command for quick health overview
- JSON and pretty output formats
- Encrypted token storage (AES-256-GCM)
- Auto token refresh
- Date selection with `--date` flag
- Pagination support with `--all` flag
- SKILL.md for AI agent integration
- Comprehensive test suite

### Security
- Tokens encrypted at rest
- Machine-bound encryption keys
- No third-party data sharing

## [0.1.0] - 2026-01-12

### Added
- Project initialization
- Core architecture and types
- CLI framework with Commander
- Test infrastructure with Vitest

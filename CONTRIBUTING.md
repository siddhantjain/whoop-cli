# Contributing to whoop-cli

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/whoop-cli.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

```bash
# Run in development mode
npm run dev -- --help

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check types
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

## Code Style

- We use TypeScript with strict mode
- ESLint and Prettier enforce consistent style
- Run `npm run lint:fix` and `npm run format` before committing

## Testing

- All new features should include tests
- We maintain 80%+ code coverage
- Tests live in `tests/` and use Vitest
- Mock external APIs; don't make real WHOOP API calls in tests

Example test:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { getRecovery } from '../src/api/client.js';

describe('getRecovery', () => {
  it('should fetch recovery data', async () => {
    // Your test here
  });
});
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code refactoring
- `chore:` — Maintenance

Examples:
```
feat: add sleep stage breakdown to pretty output
fix: handle token refresh race condition
docs: add examples for agent integration
test: add coverage for date parsing edge cases
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass: `npm test`
4. Ensure no lint errors: `npm run lint`
5. Update CHANGELOG.md under "Unreleased"
6. Submit PR with clear description

## Reporting Issues

When reporting bugs, please include:
- Node.js version (`node --version`)
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## Security

If you find a security vulnerability, please **do not** open a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure.

## Questions?

Feel free to open a discussion or reach out to the maintainers.

Thank you for contributing! 💪

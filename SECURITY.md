# Security Policy

## Token Storage

whoop-cli stores OAuth tokens locally in `~/.whoop-cli/tokens.json`. These tokens are:

- **Encrypted at rest** using AES-256-GCM
- **Machine-bound** — encryption key derived from machine identifiers
- **Auto-refreshed** — access tokens rotate; refresh tokens are long-lived

### What's stored

```
~/.whoop-cli/
├── tokens.json      # Encrypted OAuth tokens
└── config.json      # Non-sensitive settings
```

### Token lifecycle

1. `whoop auth login` initiates OAuth2 flow
2. WHOOP redirects to local callback server
3. Tokens are encrypted and stored locally
4. Access token (1 hour) auto-refreshes using refresh token
5. `whoop auth logout` securely deletes stored tokens

## Permissions

The CLI requests only necessary OAuth scopes:
- `read:profile`
- `read:body_measurement`
- `read:recovery`
- `read:sleep`
- `read:workout`
- `read:cycles`

No write permissions are requested.

## Network Security

- All API calls use HTTPS
- No data is sent to third parties
- No telemetry or analytics

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. Email: post.siddhant@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and will work with you to understand and address the issue.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x   | ✅ Yes    |

## Best Practices for Users

1. **Keep your system secure** — The encryption key is machine-bound
2. **Don't share token files** — They contain encrypted credentials
3. **Use environment variables** for client ID/secret in CI/CD
4. **Rotate tokens periodically** with `whoop auth logout && whoop auth login`

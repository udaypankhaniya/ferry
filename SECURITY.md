# Security Policy

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Email: udaypankhaniya7@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (optional)

You'll receive a response within 72 hours.

## Security Model

- **Credentials are never stored in plaintext.** Ferry uses the OS keychain (via `zalando/go-keyring`) with an AES-256-GCM encrypted file fallback at `~/.ferry/vault/`.
- **AI providers never receive credentials, private keys, or environment variables.** All sensitive fields are redacted before any prompt is sent.
- **AI command execution requires explicit user approval.** Ferry never auto-executes AI-suggested commands.
- **Ollama (local) is the default AI provider.** Cloud providers are opt-in and always visibly labeled.
- **No CGO.** Ferry uses `modernc.org/sqlite` (pure Go) — no native SQLite bindings that could introduce memory-safety bugs.

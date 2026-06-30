// Frontend mirror of the backend redaction gate (internal/ai/redact.go) — used
// ONLY to *show* the user that secrets were stripped before send. The actual
// redaction still happens in Go; this is the visible-trust signal.
const PATTERNS: RegExp[] = [
  // PEM private key blocks
  /-----BEGIN [^-]*PRIVATE KEY-----/i,
  // KEY=value / KEY: value where the key name smells secret
  /\b[A-Z0-9_]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[A-Z0-9_]*\s*[=:]\s*\S+/i,
  // CLI secret flags
  /--?(?:password|passwd|token|secret|api[-_]?key|p)\b(?:\s+|=)\S+/i,
  // auth headers
  /\b(?:authorization|bearer|basic)\s+[A-Za-z0-9._\-+/=]+/i,
  // user:password@host
  /[a-z][a-z0-9+.\-]*:\/\/[^\s:/@]+:[^\s:/@]+@/i,
]

// True if the text looks like it contains something the backend will redact.
export function hasSecrets(text: string): boolean {
  return PATTERNS.some((p) => p.test(text))
}

package ai

import "regexp"

// Redaction is the AI layer's safety gate. Nothing leaves the machine for a
// cloud provider (or even a local one) without passing through Redact first.
// The hard rule: never send credentials, private keys, tokens, or env to any
// provider. We strip aggressively — a false positive (over-redaction) is always
// preferable to leaking a secret.

const redacted = "«redacted»"

var redactors = []*regexp.Regexp{
	// PEM private key blocks (SSH keys, TLS keys).
	regexp.MustCompile(`(?s)-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----`),
	// KEY=value / KEY: value where the key name smells secret.
	regexp.MustCompile(`(?i)\b([A-Z0-9_]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[A-Z0-9_]*)\s*[=:]\s*\S+`),
	// CLI secret flags: --password foo, -p=foo, --token=bar.
	regexp.MustCompile(`(?i)(--?(?:password|passwd|token|secret|api[-_]?key|p)\b)(\s+|=)\S+`),
	// HTTP Authorization / Bearer headers.
	regexp.MustCompile(`(?i)\b(authorization|bearer|basic)\s+[A-Za-z0-9._\-+/=]+`),
	// user:password@host in URLs / connection strings.
	regexp.MustCompile(`(?i)([a-z][a-z0-9+.\-]*://[^\s:/@]+):[^\s:/@]+@`),
}

// Redact returns s with anything that looks like a secret replaced.
func Redact(s string) string {
	if s == "" {
		return s
	}
	out := s
	out = redactors[0].ReplaceAllString(out, redacted)
	out = redactors[1].ReplaceAllString(out, "$1="+redacted)
	out = redactors[2].ReplaceAllString(out, "$1 "+redacted)
	out = redactors[3].ReplaceAllString(out, "$1 "+redacted)
	out = redactors[4].ReplaceAllString(out, "$1:"+redacted+"@")
	return out
}

// RedactContext returns a copy of c with every free-text field redacted.
// Host is an alias only (never a credential) so it is left intact.
func RedactContext(c CommandContext) CommandContext {
	c.Command = Redact(c.Command)
	c.Stdout = Redact(c.Stdout)
	c.Stderr = Redact(c.Stderr)
	for i := range c.Recent {
		c.Recent[i] = Redact(c.Recent[i])
	}
	return c
}

package ai

import (
	"strings"
	"testing"
)

// Each case is a string that contains a secret which must NOT survive redaction.
func TestRedactStripsSecrets(t *testing.T) {
	cases := []struct {
		name   string
		in     string
		secret string // must be absent from the output
	}{
		{"env key=value", "export API_KEY=abc123def", "abc123def"},
		{"password assignment", "DB_PASSWORD=hunter2", "hunter2"},
		{"token colon", "github_token: ghp_AbCdEf123", "ghp_AbCdEf123"},
		{"password flag", "mysql --password supersecret -h db", "supersecret"},
		{"short -p flag", "curl -p mypass http://x", "mypass"},
		{"bearer header", "Authorization: Bearer eyJhbGciOi", "eyJhbGciOi"},
		{"url credentials", "psql postgres://user:p4ss@host/db", "p4ss"},
		{"pem private key", "-----BEGIN OPENSSH PRIVATE KEY-----\nMIIabc\n-----END OPENSSH PRIVATE KEY-----", "MIIabc"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out := Redact(c.in)
			if strings.Contains(out, c.secret) {
				t.Fatalf("secret leaked through Redact\n in:  %q\n out: %q\n leaked: %q", c.in, out, c.secret)
			}
			if !strings.Contains(out, redacted) {
				t.Fatalf("expected a redaction marker in %q", out)
			}
		})
	}
}

func TestRedactPreservesBenignText(t *testing.T) {
	benign := []string{
		"ls -la /var/log",
		"grep -r TODO ./src",
		"docker ps --format '{{.Names}}'",
		"git commit -m 'fix the parser'",
	}
	for _, s := range benign {
		if got := Redact(s); got != s {
			t.Errorf("benign text altered:\n in:  %q\n out: %q", s, got)
		}
	}
}

func TestRedactURLKeepsHostAndUser(t *testing.T) {
	out := Redact("postgres://admin:secretpw@db.internal:5432/app")
	if strings.Contains(out, "secretpw") {
		t.Fatalf("password leaked: %q", out)
	}
	// The non-secret parts stay so the command still reads usefully.
	for _, keep := range []string{"admin", "db.internal", "5432"} {
		if !strings.Contains(out, keep) {
			t.Errorf("expected %q to survive redaction, got %q", keep, out)
		}
	}
}

func TestRedactContextFieldsAndHost(t *testing.T) {
	cc := CommandContext{
		Command:  "deploy --token=ghp_secret123",
		Stdout:   "ok",
		Stderr:   "PASSWORD=leakme failed",
		ExitCode: 1,
		Host:     "prod-web-1", // alias — must be preserved verbatim
		Recent:   []string{"export SECRET=topsecret"},
	}
	r := RedactContext(cc)

	if strings.Contains(r.Command, "ghp_secret123") {
		t.Errorf("command secret leaked: %q", r.Command)
	}
	if strings.Contains(r.Stderr, "leakme") {
		t.Errorf("stderr secret leaked: %q", r.Stderr)
	}
	if strings.Contains(r.Recent[0], "topsecret") {
		t.Errorf("recent-command secret leaked: %q", r.Recent[0])
	}
	if r.Host != "prod-web-1" {
		t.Errorf("host alias must not be redacted, got %q", r.Host)
	}
	if r.ExitCode != 1 {
		t.Errorf("exit code mutated: %d", r.ExitCode)
	}
}

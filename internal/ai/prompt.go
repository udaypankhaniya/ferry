package ai

import (
	"fmt"
	"strings"
)

// maxField caps any single free-text field sent to a provider. stderr gets
// tail priority (the error is usually at the end); stdout is head-truncated.
const maxField = 4000

func truncTail(s string) string {
	if len(s) <= maxField {
		return s
	}
	return "…(truncated)…\n" + s[len(s)-maxField:]
}

func truncHead(s string) string {
	if len(s) <= maxField {
		return s
	}
	return s[:maxField] + "\n…(truncated)…"
}

// systemPrompt instructs any model to behave as a terse shell assistant and to
// answer in the strict JSON shape we parse back into a Suggestion.
const systemPrompt = `You are a terminal operations assistant embedded in an SSH client.
Be precise and concise. Never invent host facts you weren't given.
Respond ONLY with a JSON object of this exact shape:
{"explanation": string, "commands": [string, ...]}
"commands" are safe, ready-to-run shell commands the user will review before running; omit or leave empty if none apply. No prose outside the JSON.`

// buildExplain renders the user message for the Explain (debug a failure) call.
func buildExplain(c CommandContext) string {
	var b strings.Builder
	fmt.Fprintf(&b, "A command failed on host %q", c.Host)
	if c.OSInfo != "" {
		fmt.Fprintf(&b, " (%s)", c.OSInfo)
	}
	b.WriteString(".\n\n")
	fmt.Fprintf(&b, "Command:\n%s\n\n", c.Command)
	fmt.Fprintf(&b, "Exit code: %d\n\n", c.ExitCode)
	if s := truncHead(c.Stdout); s != "" {
		fmt.Fprintf(&b, "Stdout:\n%s\n\n", s)
	}
	if s := truncTail(c.Stderr); s != "" {
		fmt.Fprintf(&b, "Stderr:\n%s\n\n", s)
	}
	if len(c.Recent) > 0 {
		fmt.Fprintf(&b, "Recent commands on this host:\n%s\n\n", strings.Join(c.Recent, "\n"))
	}
	b.WriteString("Explain why it failed and propose a fix.")
	return b.String()
}

// buildTranslate renders the user message for the NL→command call.
func buildTranslate(nl string, host HostInfo) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Translate this request into shell command(s) for host %q", host.Alias)
	if host.OSInfo != "" {
		fmt.Fprintf(&b, " (%s)", host.OSInfo)
	}
	b.WriteString(":\n\n")
	b.WriteString(nl)
	return b.String()
}

// Package capture turns raw command execution into the clean, structured
// CommandContext the AI layer needs. This is the "one hard problem" from the
// spec: it uses exec mode (separated stdout/stderr + exit code) rather than
// scraping the interactive PTY byte stream.
package capture

import (
	"ferry/internal/ai"
	internalssh "ferry/internal/ssh"

	gossh "golang.org/x/crypto/ssh"
)

// Run executes command on the host and packages the result as an ai.CommandContext.
// host is an alias only (never a credential); recent is the last N commands run
// on this host, used for history-aware suggestions.
func Run(client *gossh.Client, command, host, osInfo string, recent []string) (ai.CommandContext, error) {
	res, err := internalssh.Run(client, command)
	if err != nil {
		return ai.CommandContext{}, err
	}
	return ai.CommandContext{
		Command:  command,
		Stdout:   res.Stdout,
		Stderr:   res.Stderr,
		ExitCode: res.ExitCode,
		Host:     host,
		OSInfo:   osInfo,
		Recent:   recent,
	}, nil
}

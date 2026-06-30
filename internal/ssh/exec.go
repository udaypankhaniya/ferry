package ssh

import (
	"bytes"

	"golang.org/x/crypto/ssh"
)

// ExecResult is the clean, structured outcome of a single exec-mode command.
// Approach A from the spec: running via exec (not the interactive PTY) gives
// separated stdout/stderr and a real exit code for free — ideal AI context.
type ExecResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// Run executes one command over a fresh SSH session and captures its output.
// A non-zero exit is returned in ExitCode (not as a Go error); a nil error
// means the command ran to completion, whatever its exit status.
func Run(client *ssh.Client, cmd string) (ExecResult, error) {
	sess, err := client.NewSession()
	if err != nil {
		return ExecResult{}, err
	}
	defer sess.Close()

	var stdout, stderr bytes.Buffer
	sess.Stdout = &stdout
	sess.Stderr = &stderr

	runErr := sess.Run(cmd)

	res := ExecResult{Stdout: stdout.String(), Stderr: stderr.String()}
	switch e := runErr.(type) {
	case nil:
		res.ExitCode = 0
	case *ssh.ExitError:
		res.ExitCode = e.ExitStatus()
	default:
		// Transport-level failure (session died, etc.) — surface as error.
		return res, runErr
	}
	return res, nil
}

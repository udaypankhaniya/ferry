package ssh

import (
	"io"

	"golang.org/x/crypto/ssh"
)

// Shell is an interactive PTY session over an existing SSH connection.
// Stdout carries the merged stdout+stderr stream from the remote shell
// (the PTY folds stderr into stdout). Write keystrokes to Stdin.
type Shell struct {
	session *ssh.Session
	Stdin   io.WriteCloser
	Stdout  io.Reader
}

// OpenShell allocates a PTY and starts the remote login shell.
// cols/rows are the initial terminal size; resize later with Resize.
func OpenShell(client *ssh.Client, cols, rows int) (*Shell, error) {
	sess, err := client.NewSession()
	if err != nil {
		return nil, err
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sess.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		sess.Close()
		return nil, err
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		sess.Close()
		return nil, err
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		sess.Close()
		return nil, err
	}

	if err := sess.Shell(); err != nil {
		sess.Close()
		return nil, err
	}

	return &Shell{session: sess, Stdin: stdin, Stdout: stdout}, nil
}

// Resize informs the remote PTY of a new window size.
func (s *Shell) Resize(cols, rows int) error {
	return s.session.WindowChange(rows, cols)
}

// Wait blocks until the remote shell exits.
func (s *Shell) Wait() error {
	return s.session.Wait()
}

// Close tears down the shell session.
func (s *Shell) Close() error {
	_ = s.Stdin.Close()
	return s.session.Close()
}

package ssh

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

type ConnectParams struct {
	Host     string
	Port     int
	Username string
	AuthType string // "password" | "key" | "agent"
	Secret   string // password, or passphrase for key auth
	KeyPath  string // path to private key file (key auth)
}

// Connect opens an SSH connection and returns the client.
func Connect(p ConnectParams) (*ssh.Client, error) {
	auth, err := authMethod(p)
	if err != nil {
		return nil, fmt.Errorf("ssh: auth: %w", err)
	}

	cfg := &ssh.ClientConfig{
		User:            p.Username,
		Auth:            []ssh.AuthMethod{auth},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO Phase G: known_hosts
		Timeout:         15 * time.Second,
	}

	addr := net.JoinHostPort(p.Host, strconv.Itoa(p.Port))
	client, err := ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return nil, fmt.Errorf("ssh: dial %s: %w", addr, err)
	}
	return client, nil
}

func authMethod(p ConnectParams) (ssh.AuthMethod, error) {
	switch p.AuthType {
	case "password":
		return ssh.Password(p.Secret), nil

	case "key":
		keyPath := p.KeyPath
		if keyPath == "" {
			keyPath = "~/.ssh/id_rsa"
		}
		pemData, err := os.ReadFile(expandHome(keyPath))
		if err != nil {
			return nil, fmt.Errorf("read key %s: %w", keyPath, err)
		}
		var signer ssh.Signer
		if p.Secret != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(pemData, []byte(p.Secret))
		} else {
			signer, err = ssh.ParsePrivateKey(pemData)
		}
		if err != nil {
			return nil, fmt.Errorf("parse key: %w", err)
		}
		return ssh.PublicKeys(signer), nil

	case "agent":
		sockPath := os.Getenv("SSH_AUTH_SOCK")
		if sockPath == "" {
			return nil, fmt.Errorf("SSH_AUTH_SOCK not set — start an SSH agent and retry")
		}
		conn, err := net.Dial("unix", sockPath)
		if err != nil {
			return nil, fmt.Errorf("ssh agent socket: %w", err)
		}
		ag := agent.NewClient(conn)
		return ssh.PublicKeysCallback(ag.Signers), nil

	default:
		return nil, fmt.Errorf("unsupported auth type: %s", p.AuthType)
	}
}

func expandHome(path string) string {
	if len(path) > 1 && path[:2] == "~/" {
		home, _ := os.UserHomeDir()
		return home + path[1:]
	}
	return path
}

// Ping tests connectivity without a full handshake.
func Ping(host string, port int) error {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return err
	}
	return conn.Close()
}

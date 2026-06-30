package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"strconv"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	internalssh "ferry/internal/ssh"
	"ferry/internal/transfer"
	"ferry/internal/vault"

	gossh "golang.org/x/crypto/ssh"
)

type FileEntry = transfer.FileEntry

// transferEvent is emitted on "transfer:progress" for each chunk.
type transferEvent struct {
	ID    string `json:"id"`
	Done  int64  `json:"done"`
	Total int64  `json:"total"`
}

// SSHService manages live connections. Despite the name it also brokers FTP:
// SFTP and FTP both sit behind transfer.TransferClient, so the transfer methods
// don't branch on protocol. SSH-only features (terminal shell) require conns.
type SSHService struct {
	ctx     context.Context
	mu      sync.RWMutex
	conns   map[string]*gossh.Client
	sftps   map[string]*transfer.SFTPClient
	ftps    map[string]*transfer.FTPClient
	shells  map[string]*internalssh.Shell
	siteSvc *SiteService
}

func NewSSHService(siteSvc *SiteService) *SSHService {
	return &SSHService{
		conns:   make(map[string]*gossh.Client),
		sftps:   make(map[string]*transfer.SFTPClient),
		ftps:    make(map[string]*transfer.FTPClient),
		shells:  make(map[string]*internalssh.Shell),
		siteSvc: siteSvc,
	}
}

// xfer returns the transfer channel for a site, whichever protocol backs it.
func (s *SSHService) xfer(siteID string) (transfer.TransferClient, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if c, ok := s.sftps[siteID]; ok {
		return c, true
	}
	if c, ok := s.ftps[siteID]; ok {
		return c, true
	}
	return nil, false
}

// setContext is called from main.go startup so runtime events can be emitted.
func (s *SSHService) setContext(ctx context.Context) {
	s.ctx = ctx
}

// Connect opens a transfer channel for the site using its stored credential.
// FTP sites take the FTP path; everything else takes SSH + SFTP.
func (s *SSHService) Connect(siteID string) error {
	sites, err := s.siteSvc.GetSites()
	if err != nil {
		return err
	}
	var site *Site
	for i := range sites {
		if sites[i].ID == siteID {
			site = &sites[i]
			break
		}
	}
	if site == nil {
		return fmt.Errorf("site %s not found", siteID)
	}

	secret, _ := vault.Load(siteID)

	// FTP / FTPS: no SSH transport, no interactive terminal.
	if site.Protocol == "ftp" {
		port := site.Port
		if port == 0 {
			port = 21
		}
		ftpc, ftpErr := transfer.NewFTP(net.JoinHostPort(site.Host, strconv.Itoa(port)), site.Username, secret, false)
		if ftpErr != nil {
			return ftpErr
		}
		s.mu.Lock()
		if old, ok := s.ftps[siteID]; ok {
			old.Close()
		}
		s.ftps[siteID] = ftpc
		s.mu.Unlock()
		_ = s.siteSvc.MarkConnected(siteID)
		return nil
	}

	client, err := internalssh.Connect(internalssh.ConnectParams{
		Host:     site.Host,
		Port:     site.Port,
		Username: site.Username,
		AuthType: site.AuthType,
		Secret:   secret,
		KeyPath:  site.KeyPath,
	})
	if err != nil {
		return err
	}

	s.mu.Lock()
	if old, ok := s.conns[siteID]; ok {
		old.Close()
	}
	s.conns[siteID] = client
	s.mu.Unlock()

	// Attempt SFTP for all SSH-based protocols; not a hard failure if unavailable.
	if site.Protocol != "ftp" {
		sftpClient, sftpErr := transfer.NewSFTP(client)
		if sftpErr == nil {
			s.mu.Lock()
			s.sftps[siteID] = sftpClient
			s.mu.Unlock()
		}
	}

	_ = s.siteSvc.MarkConnected(siteID)
	return nil
}

// Disconnect closes the transfer channel (SFTP or FTP) and any SSH session.
func (s *SSHService) Disconnect(siteID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.sftps[siteID]; ok {
		c.Close()
		delete(s.sftps, siteID)
	}
	if c, ok := s.ftps[siteID]; ok {
		c.Close()
		delete(s.ftps, siteID)
	}
	if c, ok := s.conns[siteID]; ok {
		c.Close()
		delete(s.conns, siteID)
	}
	return nil
}

// ListDir returns remote directory entries for a connected site (SFTP or FTP).
func (s *SSHService) ListDir(siteID, remotePath string) ([]FileEntry, error) {
	c, ok := s.xfer(siteID)
	if !ok {
		return nil, fmt.Errorf("no transfer channel for site %s (not connected, or terminal-only SSH server)", siteID)
	}
	return c.ListDir(context.Background(), remotePath)
}

// UploadFile transfers a local file to the remote host.
// transferID is a UUID from the frontend used to correlate progress events.
func (s *SSHService) UploadFile(transferID, siteID, localPath, remotePath string) error {
	c, ok := s.xfer(siteID)
	if !ok {
		return fmt.Errorf("no transfer channel for site %s", siteID)
	}
	return c.Upload(context.Background(), localPath, remotePath, func(done, total int64) {
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "transfer:progress", transferEvent{
				ID:    transferID,
				Done:  done,
				Total: total,
			})
		}
	})
}

// DownloadFile transfers a remote file (or, on SFTP, a directory tree) to the
// local filesystem. transferID correlates Wails progress events.
func (s *SSHService) DownloadFile(transferID, siteID, remotePath, localPath string) error {
	emit := func(done, total int64) {
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, "transfer:progress", transferEvent{ID: transferID, Done: done, Total: total})
		}
	}

	// SFTP supports recursive directory download; take that path when available.
	s.mu.RLock()
	sc, sftpOK := s.sftps[siteID]
	s.mu.RUnlock()
	if sftpOK {
		info, err := sc.Stat(remotePath)
		if err != nil {
			return err
		}
		if info.IsDir() {
			return sc.DownloadDir(context.Background(), remotePath, localPath, emit)
		}
		return sc.Download(context.Background(), remotePath, localPath, emit)
	}

	// FTP (single file only; directory download is not yet supported here).
	c, ok := s.xfer(siteID)
	if !ok {
		return fmt.Errorf("no transfer channel for site %s", siteID)
	}
	return c.Download(context.Background(), remotePath, localPath, emit)
}

// RemoveFile deletes a remote file or directory.
func (s *SSHService) RemoveFile(siteID, remotePath string) error {
	c, ok := s.xfer(siteID)
	if !ok {
		return fmt.Errorf("not connected to site %s", siteID)
	}
	return c.Remove(context.Background(), remotePath)
}

// RenameFile moves or renames a remote file.
func (s *SSHService) RenameFile(siteID, oldPath, newPath string) error {
	c, ok := s.xfer(siteID)
	if !ok {
		return fmt.Errorf("not connected to site %s", siteID)
	}
	return c.Rename(context.Background(), oldPath, newPath)
}

// MkdirRemote creates a remote directory.
func (s *SSHService) MkdirRemote(siteID, remotePath string) error {
	c, ok := s.xfer(siteID)
	if !ok {
		return fmt.Errorf("not connected to site %s", siteID)
	}
	return c.Mkdir(context.Background(), remotePath)
}

// StoreCredential saves a credential for a site.
func (s *SSHService) StoreCredential(siteID, secret string) error {
	return vault.Store(siteID, secret)
}

// HasCredential returns true if a credential is stored for the site.
func (s *SSHService) HasCredential(siteID string) bool {
	_, err := vault.Load(siteID)
	return err == nil
}

// IsConnected returns true if the site has an active transfer channel
// (SSH/SFTP or FTP).
func (s *SSHService) IsConnected(siteID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.conns[siteID]; ok {
		return true
	}
	_, ok := s.ftps[siteID]
	return ok
}

// clientFor returns the live SSH client for a site, for in-process use by other
// services (e.g. AIService exec capture). Not bound to the frontend.
func (s *SSHService) clientFor(siteID string) (*gossh.Client, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.conns[siteID]
	return c, ok
}

// ── interactive terminal (PTY) ─────────────────────────────────────────────────

// OpenShell starts a PTY shell over the site's SSH connection.
// sessionID is a frontend-generated UUID used to scope per-terminal events:
//   - "terminal:data:<sessionID>"  — base64 chunks of shell output
//   - "terminal:exit:<sessionID>"  — emitted once when the shell ends
func (s *SSHService) OpenShell(sessionID, siteID string, cols, rows int) error {
	s.mu.RLock()
	client, ok := s.conns[siteID]
	s.mu.RUnlock()
	if !ok {
		return fmt.Errorf("not connected to site %s", siteID)
	}

	shell, err := internalssh.OpenShell(client, cols, rows)
	if err != nil {
		return err
	}

	s.mu.Lock()
	if old, exists := s.shells[sessionID]; exists {
		old.Close()
	}
	s.shells[sessionID] = shell
	s.mu.Unlock()

	dataEvent := "terminal:data:" + sessionID
	exitEvent := "terminal:exit:" + sessionID

	// Pump shell output to the frontend until EOF, then signal exit.
	go func() {
		buf := make([]byte, 4096)
		for {
			n, readErr := shell.Stdout.Read(buf)
			if n > 0 && s.ctx != nil {
				runtime.EventsEmit(s.ctx, dataEvent, base64.StdEncoding.EncodeToString(buf[:n]))
			}
			if readErr != nil {
				break
			}
		}
		shell.Wait()
		s.mu.Lock()
		delete(s.shells, sessionID)
		s.mu.Unlock()
		if s.ctx != nil {
			runtime.EventsEmit(s.ctx, exitEvent)
		}
	}()

	return nil
}

// WriteShell forwards keystrokes from the frontend terminal to the remote shell.
func (s *SSHService) WriteShell(sessionID, data string) error {
	s.mu.RLock()
	shell, ok := s.shells[sessionID]
	s.mu.RUnlock()
	if !ok {
		return fmt.Errorf("no shell for session %s", sessionID)
	}
	_, err := io.WriteString(shell.Stdin, data)
	return err
}

// ResizeShell informs the remote PTY of a new window size.
func (s *SSHService) ResizeShell(sessionID string, cols, rows int) error {
	s.mu.RLock()
	shell, ok := s.shells[sessionID]
	s.mu.RUnlock()
	if !ok {
		return fmt.Errorf("no shell for session %s", sessionID)
	}
	return shell.Resize(cols, rows)
}

// CloseShell tears down a terminal session.
func (s *SSHService) CloseShell(sessionID string) error {
	s.mu.Lock()
	shell, ok := s.shells[sessionID]
	delete(s.shells, sessionID)
	s.mu.Unlock()
	if !ok {
		return nil
	}
	return shell.Close()
}

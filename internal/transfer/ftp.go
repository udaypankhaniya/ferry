package transfer

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"time"

	"github.com/jlaffaye/ftp"
)

// FTPClient implements TransferClient over FTP / FTPS. It is the secondary
// protocol (SFTP is primary); both sit behind the same TransferClient interface
// so the service and UI layers don't branch on protocol.
type FTPClient struct {
	conn *ftp.ServerConn
}

// NewFTP dials and logs in. useTLS selects explicit FTPS (AUTH TLS); the cert is
// not verified against a CA here — host trust is the user's choice, mirroring
// the SSH InsecureIgnoreHostKey stance until known-hosts lands (Phase G).
func NewFTP(addr, user, pass string, useTLS bool) (*FTPClient, error) {
	opts := []ftp.DialOption{ftp.DialWithTimeout(15 * time.Second)}
	if useTLS {
		opts = append(opts, ftp.DialWithExplicitTLS(&tls.Config{InsecureSkipVerify: true})) //nolint:gosec // user-trusted host
	}
	conn, err := ftp.Dial(addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("ftp: dial %s: %w", addr, err)
	}
	if err := conn.Login(user, pass); err != nil {
		conn.Quit()
		return nil, fmt.Errorf("ftp: login: %w", err)
	}
	return &FTPClient{conn: conn}, nil
}

func (c *FTPClient) ListDir(_ context.Context, remotePath string) ([]FileEntry, error) {
	if remotePath == "" {
		remotePath = "/"
	}
	entries, err := c.conn.List(remotePath)
	if err != nil {
		return nil, err
	}
	out := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		if e.Name == "." || e.Name == ".." {
			continue
		}
		out = append(out, FileEntry{
			Name:      e.Name,
			Path:      path.Join(remotePath, e.Name),
			Size:      int64(e.Size),
			Modified:  e.Time.Format(time.RFC3339),
			IsDir:     e.Type == ftp.EntryTypeFolder,
			IsSymlink: e.Type == ftp.EntryTypeLink,
			IsHidden:  len(e.Name) > 0 && e.Name[0] == '.',
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

// Upload streams a local file to the remote host, reporting progress by bytes read.
func (c *FTPClient) Upload(_ context.Context, localPath, remotePath string, progress func(int64, int64)) error {
	src, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer src.Close()

	info, _ := src.Stat()
	pr := &progressReader{r: src, total: info.Size(), fn: progress}
	return c.conn.Stor(remotePath, pr)
}

// Download streams a single remote file to the local filesystem.
func (c *FTPClient) Download(_ context.Context, remotePath, localPath string, progress func(int64, int64)) error {
	resp, err := c.conn.Retr(remotePath)
	if err != nil {
		return err
	}
	defer resp.Close()

	dst, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	// SIZE isn't universally supported; a 0 total just means an indeterminate bar.
	total, _ := c.conn.FileSize(remotePath)
	pw := &accumProgressWriter{w: dst, total: total, fn: progress}
	_, err = io.Copy(pw, resp)
	return err
}

func (c *FTPClient) Mkdir(_ context.Context, remotePath string) error {
	return c.conn.MakeDir(remotePath)
}

func (c *FTPClient) Rename(_ context.Context, oldPath, newPath string) error {
	return c.conn.Rename(oldPath, newPath)
}

// Remove deletes a file; if that fails it retries as a directory.
func (c *FTPClient) Remove(_ context.Context, remotePath string) error {
	if err := c.conn.Delete(remotePath); err != nil {
		return c.conn.RemoveDir(remotePath)
	}
	return nil
}

func (c *FTPClient) Close() error {
	return c.conn.Quit()
}

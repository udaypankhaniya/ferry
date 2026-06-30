package transfer

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// FileEntry mirrors the JSON type the frontend expects.
type FileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	Modified    string `json:"modified"`
	Permissions string `json:"permissions"`
	IsDir       bool   `json:"isDir"`
	IsSymlink   bool   `json:"isSymlink"`
	IsHidden    bool   `json:"isHidden"`
}

// TransferClient abstracts SFTP and FTP behind one interface.
type TransferClient interface {
	ListDir(ctx context.Context, remotePath string) ([]FileEntry, error)
	Upload(ctx context.Context, localPath, remotePath string, progress func(done, total int64)) error
	Download(ctx context.Context, remotePath, localPath string, progress func(done, total int64)) error
	Mkdir(ctx context.Context, remotePath string) error
	Rename(ctx context.Context, oldPath, newPath string) error
	Remove(ctx context.Context, remotePath string) error
	Close() error
}

// ── progress wrappers ──────────────────────────────────────────────────────────

// progressReader counts bytes read — used for upload.
// io.Copy(sftpFile, progressReader) → sftpFile.ReadFrom(pr) → concurrent SFTP writes.
type progressReader struct {
	r     io.Reader
	done  int64
	total int64
	fn    func(int64, int64)
}

func (p *progressReader) Read(buf []byte) (n int, err error) {
	n, err = p.r.Read(buf)
	if n > 0 {
		p.done += int64(n)
		if p.fn != nil {
			p.fn(p.done, p.total)
		}
	}
	return
}

// accumProgressWriter counts bytes written with a running offset across multiple files.
// Used for directory downloads where bytes from prior files accumulate.
type accumProgressWriter struct {
	w      io.Writer
	offset int64 // bytes already done from previous files in a dir download
	local  int64 // bytes done in the current file
	total  int64 // grand total across all files
	fn     func(int64, int64)
}

func (p *accumProgressWriter) Write(buf []byte) (n int, err error) {
	n, err = p.w.Write(buf)
	if n > 0 {
		p.local += int64(n)
		if p.fn != nil {
			p.fn(p.offset+p.local, p.total)
		}
	}
	return
}

// ── SFTP implementation ────────────────────────────────────────────────────────

type SFTPClient struct {
	ssh  *ssh.Client
	sftp *sftp.Client
}

func NewSFTP(sshClient *ssh.Client) (*SFTPClient, error) {
	sc, err := sftp.NewClient(sshClient,
		sftp.MaxConcurrentRequestsPerFile(128),
		sftp.MaxPacketChecked(1<<15),
	)
	if err != nil {
		return nil, err
	}
	return &SFTPClient{ssh: sshClient, sftp: sc}, nil
}

func (c *SFTPClient) Stat(remotePath string) (os.FileInfo, error) {
	return c.sftp.Stat(remotePath)
}

func (c *SFTPClient) ListDir(_ context.Context, remotePath string) ([]FileEntry, error) {
	infos, err := c.sftp.ReadDir(remotePath)
	if err != nil {
		return nil, err
	}
	entries := make([]FileEntry, 0, len(infos))
	for _, info := range infos {
		entries = append(entries, FileEntry{
			Name:        info.Name(),
			Path:        filepath.ToSlash(filepath.Join(remotePath, info.Name())),
			Size:        info.Size(),
			Modified:    info.ModTime().Format(time.RFC3339),
			Permissions: info.Mode().String(),
			IsDir:       info.IsDir(),
			IsSymlink:   info.Mode()&os.ModeSymlink != 0,
			IsHidden:    len(info.Name()) > 0 && info.Name()[0] == '.',
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return entries[i].Name < entries[j].Name
	})
	return entries, nil
}

// Upload streams a local file to the remote host using concurrent SFTP writes.
func (c *SFTPClient) Upload(_ context.Context, localPath, remotePath string, progress func(int64, int64)) error {
	src, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer src.Close()

	info, _ := src.Stat()
	dst, err := c.sftp.Create(remotePath)
	if err != nil {
		return err
	}
	defer dst.Close()

	pr := &progressReader{r: src, total: info.Size(), fn: progress}
	_, err = io.Copy(dst, pr)
	return err
}

// Download streams a single remote file to the local filesystem using concurrent SFTP reads.
func (c *SFTPClient) Download(_ context.Context, remotePath, localPath string, progress func(int64, int64)) error {
	return c.downloadFile(remotePath, localPath, nil, 0, progress)
}

// DownloadDir recursively downloads an entire remote directory tree.
// Progress reports grand-total bytes across all files.
func (c *SFTPClient) DownloadDir(_ context.Context, remotePath, localPath string, progress func(int64, int64)) error {
	total, err := c.remoteTreeSize(remotePath)
	if err != nil {
		return err
	}
	var offset int64
	return c.downloadDirRecursive(remotePath, localPath, &offset, total, progress)
}

// remoteTreeSize sums file sizes under a remote path without downloading.
func (c *SFTPClient) remoteTreeSize(remotePath string) (int64, error) {
	var total int64
	walker := c.sftp.Walk(remotePath)
	for walker.Step() {
		if walker.Err() != nil {
			continue
		}
		if !walker.Stat().IsDir() {
			total += walker.Stat().Size()
		}
	}
	return total, nil
}

func (c *SFTPClient) downloadDirRecursive(remotePath, localPath string, offset *int64, total int64, progress func(int64, int64)) error {
	if err := os.MkdirAll(localPath, 0755); err != nil {
		return err
	}
	entries, err := c.sftp.ReadDir(remotePath)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		rem := remotePath + "/" + entry.Name()
		loc := filepath.Join(localPath, entry.Name())
		if entry.IsDir() {
			if err := c.downloadDirRecursive(rem, loc, offset, total, progress); err != nil {
				return err
			}
		} else {
			if err := c.downloadFile(rem, loc, offset, total, progress); err != nil {
				return err
			}
		}
	}
	return nil
}

// downloadFile downloads one file, using offset for accumulated dir-download progress.
// When offset is nil (single-file download), uses its own total from Stat.
func (c *SFTPClient) downloadFile(remotePath, localPath string, offset *int64, grandTotal int64, progress func(int64, int64)) error {
	src, err := c.sftp.Open(remotePath)
	if err != nil {
		return err
	}
	defer src.Close()

	info, _ := src.Stat()
	fileSize := info.Size()

	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return err
	}
	dst, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	var base int64
	var total int64
	if offset != nil {
		base = *offset
		total = grandTotal
	} else {
		total = fileSize
	}

	pw := &accumProgressWriter{w: dst, offset: base, total: total, fn: progress}
	_, err = io.Copy(pw, src)
	if err == nil && offset != nil {
		*offset += fileSize
	}
	return err
}

func (c *SFTPClient) Mkdir(_ context.Context, remotePath string) error {
	return c.sftp.MkdirAll(remotePath)
}

func (c *SFTPClient) Rename(_ context.Context, oldPath, newPath string) error {
	return c.sftp.Rename(oldPath, newPath)
}

func (c *SFTPClient) Remove(_ context.Context, remotePath string) error {
	return c.sftp.Remove(remotePath)
}

func (c *SFTPClient) Close() error {
	_ = c.sftp.Close()
	return c.ssh.Close()
}

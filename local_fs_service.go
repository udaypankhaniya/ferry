package main

import (
	"os"
	"path/filepath"
	goruntime "runtime"
	"sort"
	"time"

	"ferry/internal/transfer"
)

// LocalFSService provides local filesystem operations to the frontend.
type LocalFSService struct{}

func NewLocalFSService() *LocalFSService { return &LocalFSService{} }

func (l *LocalFSService) HomeDir() string {
	home, _ := os.UserHomeDir()
	return filepath.ToSlash(home)
}

func (l *LocalFSService) ListDir(path string) ([]transfer.FileEntry, error) {
	// Root "/" on Windows → list available drives instead of failing.
	if path == "" || path == "/" {
		if goruntime.GOOS == "windows" {
			return listWindowsDrives(), nil
		}
		path = "/"
	}

	// On Windows, paths come in as forward-slash (C:/Users/…). Convert for os calls.
	nativePath := filepath.FromSlash(path)

	infos, err := os.ReadDir(nativePath)
	if err != nil {
		return nil, err
	}
	entries := make([]transfer.FileEntry, 0, len(infos))
	for _, info := range infos {
		fi, err := info.Info()
		if err != nil {
			continue
		}
		entryPath := filepath.ToSlash(filepath.Join(nativePath, info.Name()))
		entries = append(entries, transfer.FileEntry{
			Name:        info.Name(),
			Path:        entryPath,
			Size:        fi.Size(),
			Modified:    fi.ModTime().Format(time.RFC3339),
			Permissions: fi.Mode().String(),
			IsDir:       info.IsDir(),
			IsSymlink:   info.Type()&os.ModeSymlink != 0,
			IsHidden:    isHidden(info.Name()),
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

func (l *LocalFSService) MkdirAll(path string) error {
	return os.MkdirAll(filepath.FromSlash(path), 0755)
}

func (l *LocalFSService) Remove(path string) error {
	return os.RemoveAll(filepath.FromSlash(path))
}

func (l *LocalFSService) Rename(oldPath, newPath string) error {
	return os.Rename(filepath.FromSlash(oldPath), filepath.FromSlash(newPath))
}

// listWindowsDrives returns a synthetic directory listing of accessible drives.
func listWindowsDrives() []transfer.FileEntry {
	var entries []transfer.FileEntry
	for c := 'A'; c <= 'Z'; c++ {
		drive := string(c) + ":/"
		if _, err := os.Stat(drive); err == nil {
			entries = append(entries, transfer.FileEntry{
				Name:  string(c) + ":",
				Path:  drive,
				IsDir: true,
			})
		}
	}
	return entries
}

// isHidden reports whether a file should be considered hidden.
// On all platforms, dot-prefixed names are treated as hidden.
func isHidden(name string) bool {
	return len(name) > 0 && name[0] == '.'
}

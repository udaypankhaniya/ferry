package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// appConfig is the small persisted user-preferences blob at ~/.ferry/config.json.
// Kept deliberately tiny; grow it as real preferences appear.
type appConfig struct {
	LastLocalPath string `json:"lastLocalPath"`
}

// ConfigService persists lightweight UI preferences to disk so they survive app
// restarts reliably — unlike the webview's localStorage, which doesn't persist
// dependably across the native WebView2/WebKit origins. Bound to the frontend.
type ConfigService struct {
	mu   sync.Mutex
	path string
	cfg  appConfig
}

func NewConfigService() *ConfigService {
	home, _ := os.UserHomeDir()
	cs := &ConfigService{path: filepath.Join(home, ".ferry", "config.json")}
	cs.load()
	return cs
}

func (c *ConfigService) load() {
	data, err := os.ReadFile(c.path)
	if err != nil {
		return // no config yet — defaults
	}
	_ = json.Unmarshal(data, &c.cfg) // ignore malformed config; fall back to zero value
}

func (c *ConfigService) save() error {
	if err := os.MkdirAll(filepath.Dir(c.path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, data, 0600)
}

// GetLastLocalPath returns the last local directory the user browsed (empty if none).
func (c *ConfigService) GetLastLocalPath() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cfg.LastLocalPath
}

// SetLastLocalPath records the local directory so the next launch opens there.
func (c *ConfigService) SetLastLocalPath(p string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cfg.LastLocalPath = p
	return c.save()
}

package vault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/zalando/go-keyring"
)

const service = "ferry"

// Store saves a secret in the OS keychain.
// Falls back to an AES-256-GCM encrypted file if keychain unavailable.
func Store(siteID, secret string) error {
	err := keyring.Set(service, siteID, secret)
	if err == nil {
		return nil
	}
	return storeFile(siteID, secret)
}

// Load retrieves a secret stored by Store.
func Load(siteID string) (string, error) {
	secret, err := keyring.Get(service, siteID)
	if err == nil {
		return secret, nil
	}
	return loadFile(siteID)
}

// Delete removes a stored secret.
func Delete(siteID string) error {
	_ = keyring.Delete(service, siteID)
	_ = os.Remove(vaultPath(siteID))
	return nil
}

// ── file fallback ──────────────────────────────────────────────────────────

func vaultDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".ferry", "vault")
}

func vaultPath(siteID string) string {
	hash := sha256.Sum256([]byte(siteID))
	return filepath.Join(vaultDir(), base64.RawURLEncoding.EncodeToString(hash[:16])+".enc")
}

func masterKey() ([]byte, error) {
	keyFile := filepath.Join(vaultDir(), ".key")
	if data, err := os.ReadFile(keyFile); err == nil && len(data) == 32 {
		return data, nil
	}
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(keyFile), 0700); err != nil {
		return nil, err
	}
	if err := os.WriteFile(keyFile, key, 0600); err != nil {
		return nil, err
	}
	return key, nil
}

func storeFile(siteID, secret string) error {
	key, err := masterKey()
	if err != nil {
		return fmt.Errorf("vault: %w", err)
	}
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	ct := gcm.Seal(nonce, nonce, []byte(secret), nil)
	path := vaultPath(siteID)
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, ct, 0600)
}

func loadFile(siteID string) (string, error) {
	key, err := masterKey()
	if err != nil {
		return "", fmt.Errorf("vault: %w", err)
	}
	ct, err := os.ReadFile(vaultPath(siteID))
	if err != nil {
		return "", errors.New("vault: secret not found")
	}
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	if len(ct) < gcm.NonceSize() {
		return "", errors.New("vault: corrupt data")
	}
	plain, err := gcm.Open(nil, ct[:gcm.NonceSize()], ct[gcm.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("vault: decrypt failed: %w", err)
	}
	return string(plain), nil
}

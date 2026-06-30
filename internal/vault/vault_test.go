package vault

import (
	"os"
	"path/filepath"
	"testing"
)

// isolateHome points the vault at a throwaway home dir so tests never touch a
// real ~/.ferry. Both vars are set because os.UserHomeDir uses USERPROFILE on
// Windows and HOME elsewhere.
func isolateHome(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("USERPROFILE", dir)
}

func TestFileRoundTrip(t *testing.T) {
	isolateHome(t)

	const id, secret = "site-1", "hunter2-correct-horse"
	if err := storeFile(id, secret); err != nil {
		t.Fatalf("storeFile: %v", err)
	}
	got, err := loadFile(id)
	if err != nil {
		t.Fatalf("loadFile: %v", err)
	}
	if got != secret {
		t.Fatalf("round-trip mismatch: got %q want %q", got, secret)
	}
}

func TestFileIsolationBetweenSites(t *testing.T) {
	isolateHome(t)

	if err := storeFile("a", "secret-a"); err != nil {
		t.Fatal(err)
	}
	if err := storeFile("b", "secret-b"); err != nil {
		t.Fatal(err)
	}
	a, _ := loadFile("a")
	b, _ := loadFile("b")
	if a != "secret-a" || b != "secret-b" {
		t.Fatalf("sites not isolated: a=%q b=%q", a, b)
	}
}

func TestEncryptedAtRest(t *testing.T) {
	isolateHome(t)

	const secret = "plaintext-should-not-appear"
	if err := storeFile("s", secret); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(vaultPath("s"))
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) == 0 {
		t.Fatal("ciphertext file is empty")
	}
	if string(raw) == secret {
		t.Fatal("secret stored as plaintext")
	}
	for i := 0; i+len(secret) <= len(raw); i++ {
		if string(raw[i:i+len(secret)]) == secret {
			t.Fatal("plaintext secret found in ciphertext")
		}
	}
}

func TestLoadMissing(t *testing.T) {
	isolateHome(t)
	if _, err := loadFile("never-stored"); err == nil {
		t.Fatal("expected error loading a missing secret")
	}
}

func TestCorruptCiphertext(t *testing.T) {
	isolateHome(t)

	if err := storeFile("c", "x"); err != nil {
		t.Fatal(err)
	}
	// Truncate below the GCM nonce size → must error, not panic.
	if err := os.WriteFile(vaultPath("c"), []byte{0x01, 0x02}, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadFile("c"); err == nil {
		t.Fatal("expected error on corrupt ciphertext")
	}
}

func TestTamperedCiphertextFailsAuth(t *testing.T) {
	isolateHome(t)

	if err := storeFile("t", "authentic"); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(vaultPath("t"))
	raw[len(raw)-1] ^= 0xFF // flip the last byte of the GCM tag
	if err := os.WriteFile(vaultPath("t"), raw, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadFile("t"); err == nil {
		t.Fatal("GCM auth should reject tampered ciphertext")
	}
}

func TestKeyFilePersists(t *testing.T) {
	isolateHome(t)

	if err := storeFile("k", "v"); err != nil {
		t.Fatal(err)
	}
	keyFile := filepath.Join(vaultDir(), ".key")
	info, err := os.Stat(keyFile)
	if err != nil {
		t.Fatalf("master key not written: %v", err)
	}
	if info.Size() != 32 {
		t.Fatalf("master key size = %d, want 32", info.Size())
	}
}

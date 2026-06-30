# Contributing to Ferry

## Setup

```bash
git clone https://github.com/udaypankhaniya/ferry.git
cd ferry
# Linux: sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
wails dev   # opens app with hot-reload
```

## Definition of done

Both must pass before a PR is mergeable:

```bash
go build ./...
cd frontend && pnpm run typecheck
```

## Hard rules

- **No CGO.** Use `modernc.org/sqlite` only — never `mattn/go-sqlite3`. Verify: `CGO_ENABLED=0 go build ./...`
- **No direct backend calls from components.** Path: component → `src/lib/` → Wails binding.
- **AI layer:** never auto-execute suggestions; never send credentials or env to any provider.
- **No hardcoded versions** in code. Pin once in `go.mod` / `package.json`.

## PR checklist

- [ ] `go build ./...` clean
- [ ] `pnpm run typecheck` clean
- [ ] `go test ./...` passes
- [ ] No `.db`, `.enc`, `.key`, or credential files staged
- [ ] UI changes tested in both light and dark mode

## Packages

| What | Package |
|---|---|
| SQLite | `modernc.org/sqlite` |
| SSH | `golang.org/x/crypto/ssh` |
| SFTP | `github.com/pkg/sftp` |
| Keychain | `github.com/zalando/go-keyring` |
| Frontend state | Zustand |
| UI primitives | Radix UI |
| Styling | Tailwind v4 |

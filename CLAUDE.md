# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ferry is an open-source, lightweight, AI-assisted SSH + SFTP client built with Wails (Go + native webview). Two non-negotiable pillars: (1) lightweight & native — single binary, no Electron; (2) local-first AI / visible trust — local models default, cloud is opt-in and always visible.

## Commands

```bash
# Development (hot-reload, opens native window)
wails dev

# Production build
wails build

# Go only (no frontend, fast check)
go build ./...
CGO_ENABLED=0 go build ./...   # verify no CGO leak

# Frontend (from /frontend)
pnpm install
pnpm run dev          # Vite dev server only (no Wails)
pnpm run build
pnpm run typecheck    # tsc --noEmit — required before done

# Lint
golangci-lint run

# Go tests
go test ./...
go test ./internal/vault/...   # single package
```

**Definition of done:** `go build ./...` passes AND `pnpm run typecheck` passes. Both clean.

## Architecture

### Go ↔ Frontend bridge

Go services live in `*.go` files in the root `main` package (not `internal/`). They are registered in `main.go`'s `wails.Run()` `Bind` array. Wails code-generates TypeScript bindings into `frontend/wailsjs/go/main/<ServiceName>.ts`.

**Never** call generated bindings directly from components. Always wrap them in `frontend/src/lib/` (e.g. `sshService.ts` wraps `wailsjs/go/main/SSHService`). Components call `lib/` only.

Real-time events flow one way — Go pushes, frontend listens:
```go
// Go: emit
runtime.EventsEmit(ctx, "transfer:progress", payload)

// Frontend: receive
EventsOn('transfer:progress', handler)  // from wailsjs/runtime/runtime
```

The Wails context (`context.Context`) is passed to services via `OnStartup`. Services that emit events must store it (see `SSHService.setContext`).

### Package layout

| Layer | Location | Role |
|---|---|---|
| Wails services | `*.go` (root `main` pkg) | Exposed to frontend — thin orchestrators |
| Core logic | `internal/` | Pure Go, no Wails import, no CGO |
| Frontend bindings | `frontend/src/lib/` | Wrap generated Wails bindings |
| State | `frontend/src/stores/` | Zustand; one store per domain |
| UI | `frontend/src/components/` | Read from stores, call lib functions |

### Internal packages

- `internal/ssh/client.go` — `Connect(ConnectParams)` returns `*ssh.Client`; supports `password`, `key`, `agent` auth
- `internal/transfer/client.go` — `TransferClient` interface (SFTP implemented; FTP pending Phase G); also defines `FileEntry` shared across services
- `internal/vault/vault.go` — `Store`/`Load`/`Delete`; tries OS keychain (`zalando/go-keyring`) first, falls back to AES-256-GCM encrypted file at `~/.ferry/vault/`
- `internal/ai/provider.go` — `Provider` interface + `CommandContext`/`Suggestion` types; implementations not yet written (Phase F)
- `internal/history/db.go` — SQLite at `~/.ferry/history.db`; `RecordCommand`, `RecordTransfer`, `RecentCommands`
- `internal/session/`, `internal/capture/`, `internal/config/` — stubs for Phase E/F

### Data on disk

All user data lives in `~/.ferry/`:
- `sites.db` — saved connections (no passwords stored here)
- `history.db` — command and transfer history
- `vault/` — encrypted credentials (`*.enc` files + `.key`)

### Zustand stores

| Store | Owns |
|---|---|
| `appStore` | Panel widths, collapsed states, center split ratio |
| `siteStore` | Sites list, active site, connection state, local+remote pane state (path, entries, selection) |
| `transferStore` | Transfer queue (add/update/retry/clear) |
| `aiStore` | AI panel state machine, provider selection |

### Transfer progress

`SSHService.UploadFile`/`DownloadFile` emit `transfer:progress` events with `{id, done, total}`. `App.tsx` listens, computes speed + ETA, and calls `transferStore.updateItem`. The `transferID` UUID is generated on the frontend before calling the Go service.

## Hard rules

- **No CGO, ever.** `modernc.org/sqlite` only (not `mattn/go-sqlite3`). CGO breaks Wails cross-compilation.
- **AI layer:** never auto-execute AI-proposed commands. Never send credentials, private keys, or env to any provider. Redact before send. Ollama is default; cloud is opt-in.
- **No direct backend calls from components.** Components → `lib/` → Wails bindings only.
- **Version policy:** never hardcode versions. Pin once in `go.mod` / `package.json`. Use Context7 for all library API questions.

## Current state (Phase D — wiring pending)

The UI shell and all Go services exist. What's not yet wired:
- `SiteManager` doesn't call `GetSites()` on mount or `CreateSite()` on save
- Host click doesn't call `SSHService.Connect()` with credential prompt
- File browser panes not wired to `LocalFSService.ListDir()` / `SSHService.ListDir()`
- Transfer queue UI not wired to actual `UploadFile`/`DownloadFile` calls
- Terminal: xterm.js component is a shell — PTY over SSH not built (Phase E)
- AI providers: interface defined, no implementations (Phase F)

## Source of truth

`ferry-spec.md` — architecture, roadmap, AI provider contract  
`design.md` — design tokens, layout, component states, motion rules  
`PLAN.md` — task tracker, what's done vs pending

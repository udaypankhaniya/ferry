# Ferry

> Lightweight, AI-assisted SSH + SFTP client. Single binary. No Electron.

![Ferry screenshot](docs/screenshot.png)

## Features

- **SSH + SFTP** — connect, browse remote files, transfer up/down with progress tracking
- **Dual-pane file browser** — local ↔ remote, drag-to-transfer, context menus
- **Integrated terminal** — xterm.js shell with theme-aware colors
- **AI assistant** — describe a command, get a suggestion; local-first (Ollama default), cloud opt-in
- **Credential vault** — OS keychain first, AES-256-GCM encrypted file fallback; credentials never sent to AI
- **Command history** — SQLite-backed, per-site
- **Native & lightweight** — built with [Wails](https://wails.io) (Go + native webview); single binary, ~10 MB

## Non-negotiables

| Pillar | What it means |
|---|---|
| Lightweight & native | Single binary, no Electron, no bundled Chromium |
| Local-first AI / visible trust | Ollama by default; cloud is opt-in and always labeled |

## Installation

### Pre-built binaries

Download from [Releases](../../releases).

| Platform | File |
|---|---|
| Windows | `ferry-windows-amd64.exe` |
| Linux | `ferry-linux-amd64` |
| macOS | `ferry-darwin-universal` |

### Build from source

**Prerequisites**

- Go 1.21+
- Node.js 18+ + pnpm (`npm i -g pnpm`)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Linux only:** `sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev`

```bash
git clone https://github.com/udaypankhaniya/ferry.git
cd ferry
wails build
# binary at build/bin/ferry
```

**Dev mode (hot-reload):**
```bash
wails dev
```

**Verify no CGO leak (CI requirement):**
```bash
CGO_ENABLED=0 go build ./...
```

## Architecture

```
ferry/
├── *.go              # Wails services (root main pkg) — exposed to frontend
├── internal/
│   ├── ssh/          # SSH client (password / key / agent auth)
│   ├── transfer/     # SFTP transfer client + FileEntry types
│   ├── vault/        # Credential store (OS keychain → encrypted file)
│   ├── history/      # SQLite command + transfer history
│   └── ai/           # Provider interface + types
└── frontend/
    ├── src/
    │   ├── lib/       # Wails binding wrappers (components never call bindings directly)
    │   ├── stores/    # Zustand stores (appStore, siteStore, transferStore, aiStore)
    │   └── components/
    └── src/styles/    # Tailwind v4 @theme tokens (theme.css)
```

Go ↔ Frontend bridge: Wails code-generates TypeScript bindings; components call `src/lib/` wrappers only.

## AI Safety

- AI-proposed commands are **never auto-executed** — user must explicitly approve
- Credentials, private keys, and env variables are **redacted before any prompt is sent**
- Ollama (local) is the **default provider** — no data leaves your machine unless you opt in
- Cloud provider usage is always visibly indicated in the UI

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## License

[MIT](LICENSE) — © 2024 Uday Pankhaniya

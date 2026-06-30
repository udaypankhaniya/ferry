import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Plus, TerminalSquare, Sparkles, X } from 'lucide-react'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { useSiteStore } from '../../stores/siteStore'
import { useAppStore } from '../../stores/appStore'
import { openShell, writeShell, resizeShell, closeShell } from '../../lib/sshService'
import { IconButton } from '../ui'
import { cn } from '../../lib/cn'

// Read a design token off the document root so xterm matches the app theme.
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// Decode a base64 PTY chunk from Go into raw bytes for term.write.
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// The currently-visible terminal, so "Ask AI" can read its buffer. With multiple
// tabs mounted at once, the active tab registers itself here.
let activeTerm: XTerm | null = null

// Read the last `maxLines` of the active terminal as plain text.
function readActiveTerminal(maxLines = 60): string {
  if (!activeTerm) return ''
  const buf = activeTerm.buffer.active
  const start = Math.max(0, buf.length - maxLines)
  const lines: string[] = []
  for (let i = start; i < buf.length; i++) {
    lines.push(buf.getLine(i)?.translateToString(true) ?? '')
  }
  return lines.join('\n').replace(/\n+$/, '')
}

// Build an xterm theme object from the current CSS design tokens. Re-read on
// every theme switch so the terminal follows light/dark like the rest of the UI.
function xtermTheme() {
  return {
    background: token('--color-bg-inset', '#050505'),
    foreground: token('--color-text-primary', '#EDEDED'),
    cursor: token('--color-accent', '#5E6AD2'),
    cursorAccent: token('--color-bg-inset', '#050505'),
    selectionBackground: token('--color-selection', 'rgba(94,106,210,0.30)'),
  }
}

function TerminalView({ siteId, active }: { siteId: string; active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const sessionID = crypto.randomUUID()
    const term = new XTerm({
      fontFamily: token('--font-mono', 'monospace'),
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      screenReaderMode: true, // xterm's built-in accessible live-region buffer
      theme: xtermTheme(),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    fit.fit()
    termRef.current = term

    // Output: Go → "terminal:data:<id>" (base64) → xterm.
    const offData = EventsOn(`terminal:data:${sessionID}`, (chunk: string) => {
      term.write(b64ToBytes(chunk))
    })
    const offExit = EventsOn(`terminal:exit:${sessionID}`, () => {
      term.write('\r\n\x1b[2m[session closed]\x1b[0m\r\n')
    })

    // Input: keystrokes → Go.
    const inputDisp = term.onData((data) => { void writeShell(sessionID, data) })

    // Start the remote PTY, then keep its size in sync.
    void openShell(sessionID, siteId, term.cols, term.rows).catch((err) => {
      term.write(`\r\n\x1b[31mfailed to open shell: ${String(err)}\x1b[0m\r\n`)
    })
    const resizeDisp = term.onResize(({ cols, rows }) => { void resizeShell(sessionID, cols, rows) })

    const ro = new ResizeObserver(() => {
      try { fit.fit() } catch { /* container detached mid-teardown */ }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      offData()
      offExit()
      inputDisp.dispose()
      resizeDisp.dispose()
      void closeShell(sessionID)
      termRef.current = null
      if (activeTerm === term) activeTerm = null
      term.dispose()
    }
  }, [siteId])

  // The active tab owns the "Ask AI" buffer + keyboard focus.
  useEffect(() => {
    const term = termRef.current
    if (active && term) {
      activeTerm = term
      term.focus()
    }
  }, [active])

  // Follow theme switches — re-read tokens after the data-theme attribute has
  // been applied to <html> (rAF), then repaint the terminal palette.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    const id = requestAnimationFrame(() => { term.options.theme = xtermTheme() })
    return () => cancelAnimationFrame(id)
  }, [theme])

  // Terminal surface — never animated. Padding tokenized (4px / 6px) via utilities.
  return <div ref={hostRef} className="h-full w-full overflow-hidden bg-bg-inset px-1.5 py-1" />
}

interface TermTab { id: string; n: number }

export function Terminal() {
  const { activeSite, connectionState } = useSiteStore()
  const { setAIPanelCollapsed } = useAppStore()
  const connected = !!activeSite && connectionState === 'connected'

  const [tabs, setTabs] = useState<TermTab[]>([])
  const [activeId, setActiveId] = useState('')
  const counterRef = useRef(0)

  // One tab per connection; reset when the host changes or disconnects.
  useEffect(() => {
    if (connected) {
      counterRef.current = 1
      const id = crypto.randomUUID()
      setTabs([{ id, n: 1 }])
      setActiveId(id)
    } else {
      setTabs([])
      setActiveId('')
    }
  }, [connected, activeSite?.id])

  function addTab() {
    counterRef.current += 1
    const id = crypto.randomUUID()
    setTabs((t) => [...t, { id, n: counterRef.current }])
    setActiveId(id)
  }

  function closeTab(id: string) {
    setTabs((t) => {
      const next = t.filter((x) => x.id !== id)
      if (id === activeId && next.length) setActiveId(next[next.length - 1].id)
      return next
    })
  }

  // Send the visible terminal's recent output to the AI chat as context.
  function askAI() {
    const text = readActiveTerminal()
    if (!text) return
    setAIPanelCollapsed(false)
    window.dispatchEvent(new CustomEvent('ferry:ask-ai', { detail: text }))
  }

  const multi = tabs.length > 1

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-inset font-mono">
      {/* tab bar */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border-hairline bg-bg-surface px-2 pt-1">
        {connected ? (
          <div role="tablist" aria-label="Terminal sessions" className="flex h-full min-w-0 items-center gap-0.5 overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={tab.id === activeId}
                onClick={() => setActiveId(tab.id)}
                className={cn(
                  'group flex h-full shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-[11px] cursor-pointer select-none transition-colors',
                  tab.id === activeId
                    ? 'border-border-hairline bg-bg-inset text-text-primary'
                    : 'border-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-secondary'
                )}
              >
                <TerminalSquare size={12} className={cn('shrink-0', tab.id === activeId ? 'text-accent' : 'text-text-tertiary')} />
                <span className="truncate max-w-40">
                  {activeSite.username}@{activeSite.host}{multi ? ` · ${tab.n}` : ''}
                </span>
                {multi && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                    aria-label="Close terminal session"
                    className="shrink-0 rounded-sm p-0.5 text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-bg-hover hover:text-text-primary transition-opacity cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="px-1 text-[11px] text-text-tertiary">terminal</span>
        )}
        <span className="flex-1" />
        <IconButton label="Ask AI about terminal output" size="sm" disabled={!connected} onClick={askAI}><Sparkles size={14} /></IconButton>
        <IconButton label="New terminal tab" size="sm" disabled={!connected} onClick={addTab}><Plus size={14} /></IconButton>
      </div>

      {/* terminal bodies — all sessions stay mounted; inactive ones are hidden
          with visibility (not display) so they keep their size and need no refit. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {connected ? (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn('absolute inset-0', tab.id === activeId ? 'z-10' : 'invisible z-0')}
            >
              {/* key on site id so switching hosts tears down and remounts the session */}
              <TerminalView siteId={activeSite.id} active={tab.id === activeId} />
            </div>
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-[12px] text-text-tertiary">Connect a host to open a terminal session.</div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSiteStore } from '../../stores/siteStore'
import { useAppStore } from '../../stores/appStore'
import { useAIStore } from '../../stores/aiStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { cn } from '../../lib/cn'
import type { AIProvider } from '../../types'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { sites, activeSite } = useSiteStore()
  const { toggleSiteRail, toggleAIPanel, setTheme } = useAppStore()
  const { setProvider } = useAIStore()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  useEffect(() => { inputRef.current?.focus() }, [])

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      { id: 'rail', label: 'Toggle host rail', hint: 'panel', run: toggleSiteRail },
      { id: 'ai', label: 'Toggle AI panel', hint: 'panel', run: toggleAIPanel },
    ]
    // Connect to a saved host — reuse SiteManager's flow via a window event so
    // the credential prompt / connect state machine lives in one place.
    for (const s of sites) {
      cmds.push({
        id: `connect:${s.id}`,
        label: `Connect: ${s.name || s.host}`,
        hint: `${s.host} · ${s.protocol.toUpperCase()}`,
        run: () => window.dispatchEvent(new CustomEvent('ferry:connect', { detail: s.id })),
      })
    }
    if (activeSite) {
      cmds.push({
        id: 'disconnect',
        label: `Disconnect: ${activeSite.name || activeSite.host}`,
        hint: 'session',
        run: () => window.dispatchEvent(new CustomEvent('ferry:disconnect', { detail: activeSite.id })),
      })
    }
    const providers: { p: AIProvider; label: string }[] = [
      { p: 'ollama', label: 'AI provider: Ollama (local)' },
      { p: 'anthropic', label: 'AI provider: Claude (cloud)' },
      { p: 'openai', label: 'AI provider: OpenAI (cloud)' },
    ]
    for (const { p, label } of providers) {
      cmds.push({ id: `provider:${p}`, label, hint: 'ai', run: () => setProvider(p) })
    }
    cmds.push(
      { id: 'theme:dark', label: 'Theme: Dark', hint: 'theme', run: () => setTheme('dark') },
      { id: 'theme:light', label: 'Theme: Light', hint: 'theme', run: () => setTheme('light') },
      { id: 'theme:system', label: 'Theme: System', hint: 'theme', run: () => setTheme('system') },
    )
    return cmds
  }, [sites, activeSite, setProvider, setTheme, toggleSiteRail, toggleAIPanel])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q))
  }, [commands, query])

  // Keep the highlighted index in range as the filter narrows.
  useEffect(() => { setIndex(0) }, [query])

  function runAt(i: number) {
    const cmd = filtered[i]
    if (!cmd) return
    cmd.run()
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(index) }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[12vh]"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-[min(560px,90vw)] overflow-hidden rounded-md border border-border-strong bg-bg-overlay shadow-overlay"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command"
          className="w-full border-b border-border-hairline bg-transparent px-3.5 py-3 text-[14px] text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-3.5 py-3 text-[12px] text-text-tertiary">No matching commands.</div>
          )}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => runAt(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 border-l-2 px-3.5 py-1.5',
                i === index ? 'border-accent bg-accent/10' : 'border-transparent'
              )}
            >
              <span className="flex-1 text-[13px] text-text-primary">{c.label}</span>
              {c.hint && <span className="text-[10px] uppercase tracking-wide text-text-tertiary">{c.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

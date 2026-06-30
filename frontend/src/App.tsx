import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import { useTransferStore } from './stores/transferStore'
import { TitleBar } from './components/TitleBar/TitleBar'
import { SiteManager } from './components/SiteManager/SiteManager'
import { FileBrowser } from './components/FileBrowser/FileBrowser'
import { Terminal } from './components/Terminal/Terminal'
import { AIPanel } from './components/AIPanel/AIPanel'
import { StatusBar } from './components/StatusBar/StatusBar'
import { TransferQueue } from './components/TransferQueue/TransferQueue'
import { ResizeDivider } from './components/common/ResizeDivider'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { Toaster } from './components/ui'
import { useAppStore, type FocusRegion } from './stores/appStore'
import { cn } from './lib/cn'

const RAIL_COLLAPSED_W = 48

export default function App() {
  const {
    siteRailWidth, siteRailCollapsed,
    aiPanelWidth, aiPanelCollapsed,
    centerSplitRatio,
    setSiteRailWidth, setAIPanelWidth, setCenterSplitRatio,
  } = useAppStore()

  const theme = useAppStore((s) => s.theme)
  const focusedRegion = useAppStore((s) => s.focusedRegion)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // ── Region focus model ── one region is "active" at a time, shown by a
  // border-strong inset ring. Cmd/Ctrl+1..4 jump between regions.
  const regionRefs = {
    sites: useRef<HTMLDivElement>(null),
    files: useRef<HTMLDivElement>(null),
    terminal: useRef<HTMLDivElement>(null),
    ai: useRef<HTMLDivElement>(null),
  }
  const focusRegion = useCallback((r: FocusRegion) => {
    const st = useAppStore.getState()
    if (r === 'ai' && st.aiPanelCollapsed) st.toggleAIPanel()
    if (r === 'sites' && st.siteRailCollapsed) st.toggleSiteRail()
    st.setFocusedRegion(r)
    requestAnimationFrame(() => regionRefs[r].current?.focus())
  }, [])
  const ringCls = (r: FocusRegion) =>
    focusedRegion === r ? 'ring-1 ring-inset ring-border-strong' : ''

  // floating-panel chrome shared by every region card
  const panelCls =
    'rounded-xl border border-border-hairline bg-bg-surface shadow-(--shadow-panel) overflow-hidden'

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
    }
    apply()
    if (theme === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'k') { e.preventDefault(); setPaletteOpen((o) => !o) }
      else if (k === 'b') { e.preventDefault(); useAppStore.getState().toggleSiteRail() }
      else if (k === 'j') { e.preventDefault(); useAppStore.getState().toggleAIPanel() }
      else if (k === '1') { e.preventDefault(); focusRegion('sites') }
      else if (k === '2') { e.preventDefault(); focusRegion('files') }
      else if (k === '3') { e.preventDefault(); focusRegion('terminal') }
      else if (k === '4') { e.preventDefault(); focusRegion('ai') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusRegion])

  useEffect(() => {
    const lastSample = new Map<string, { bytes: number; time: number }>()
    const off = EventsOn('transfer:progress', (data: { id: string; done: number; total: number }) => {
      const { updateItem } = useTransferStore.getState()
      const now = Date.now()
      const prev = lastSample.get(data.id)
      let speedBps = 0
      if (prev && now - prev.time > 0) {
        speedBps = Math.max(0, Math.round(((data.done - prev.bytes) / (now - prev.time)) * 1000))
      }
      lastSample.set(data.id, { bytes: data.done, time: now })
      const etaSecs = speedBps > 0 && data.total > data.done
        ? Math.round((data.total - data.done) / speedBps)
        : 0
      updateItem(data.id, {
        bytesDone: data.done,
        bytesTotal: data.total,
        progress: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
        status: 'active',
        speedBps,
        etaSecs,
      })
    })
    return () => { off(); lastSample.clear() }
  }, [])

  const onCenterDividerDelta = useCallback(
    (dy: number) => {
      const container = document.getElementById('center-pane')
      if (!container) return
      const totalH = container.offsetHeight
      const { centerSplitRatio: cur } = useAppStore.getState()
      setCenterSplitRatio(cur + dy / totalH)
    },
    [setCenterSplitRatio]
  )

  const railW = siteRailCollapsed ? RAIL_COLLAPSED_W : siteRailWidth

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base text-text-primary font-sans p-2 gap-2">
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        {/* left rail */}
        <div
          ref={regionRefs.sites}
          tabIndex={-1}
          role="region"
          aria-label="Hosts"
          onFocusCapture={() => useAppStore.getState().setFocusedRegion('sites')}
          className={cn('shrink-0 flex outline-none', panelCls, ringCls('sites'))}
          style={{ width: railW, transition: siteRailCollapsed ? 'width 160ms ease' : 'none' }}
        >
          <SiteManager />
        </div>

        {!siteRailCollapsed && (
          <ResizeDivider
            direction="vertical"
            onDelta={(dx) => {
              const { siteRailWidth: cur } = useAppStore.getState()
              setSiteRailWidth(cur + dx)
            }}
          />
        )}

        {/* center: file browser + terminal */}
        <div id="center-pane" className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <div
            ref={regionRefs.files}
            tabIndex={-1}
            role="region"
            aria-label="File browser"
            onFocusCapture={() => useAppStore.getState().setFocusedRegion('files')}
            className={cn('flex flex-col outline-none', panelCls, ringCls('files'))}
            style={{ flex: centerSplitRatio, minHeight: 80 }}
          >
            <FileBrowser />
          </div>

          <ResizeDivider direction="horizontal" onDelta={onCenterDividerDelta} />

          <div
            ref={regionRefs.terminal}
            tabIndex={-1}
            role="region"
            aria-label="Terminal"
            onFocusCapture={() => useAppStore.getState().setFocusedRegion('terminal')}
            className={cn('flex flex-col outline-none', panelCls, ringCls('terminal'))}
            style={{ flex: 1 - centerSplitRatio, minHeight: 60 }}
          >
            <Terminal />
          </div>
        </div>

        {!aiPanelCollapsed && (
          <ResizeDivider
            direction="vertical"
            onDelta={(dx) => {
              const { aiPanelWidth: cur } = useAppStore.getState()
              setAIPanelWidth(cur - dx)
            }}
          />
        )}

        {/* right: AI panel */}
        {!aiPanelCollapsed && (
          <div
            ref={regionRefs.ai}
            tabIndex={-1}
            role="region"
            aria-label="AI assistant"
            onFocusCapture={() => useAppStore.getState().setFocusedRegion('ai')}
            className={cn('shrink-0 flex min-h-0 outline-none', panelCls, ringCls('ai'))}
            style={{ width: aiPanelWidth }}
          >
            <AIPanel />
          </div>
        )}

        {/* collapsed AI tab */}
        {aiPanelCollapsed && (
          <button
            onClick={() => useAppStore.getState().toggleAIPanel()}
            title="Open AI panel (Ctrl+J)"
            className="no-drag ml-2 shrink-0 w-9 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border-hairline bg-bg-surface shadow-(--shadow-panel) cursor-pointer text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <Sparkles size={13} />
            <span className="text-[9px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
              AI
            </span>
          </button>
        )}
      </div>

      <StatusBar />
      <TransferQueue />

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <Toaster />
    </div>
  )
}

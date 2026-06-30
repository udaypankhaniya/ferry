import { useState, useRef, useCallback } from 'react'
import { ArrowUp, ArrowDown, X, Minus, RotateCw, Sparkles } from 'lucide-react'
import { useTransferStore } from '../../stores/transferStore'
import { useAppStore } from '../../stores/appStore'
import { Input, Progress, TabList, Tab } from '../ui'
import { cn } from '../../lib/cn'
import type { TransferItem, TransferStatus } from '../../types'

// Pipe a failed transfer to the AI chat (reuses the ferry:ask-ai bridge).
function askAIAboutTransfer(item: TransferItem) {
  useAppStore.getState().setAIPanelCollapsed(false)
  window.dispatchEvent(new CustomEvent('ferry:ask-ai', {
    detail: `Transfer of "${item.filename}" (${item.direction}) failed with:\n${item.error ?? 'unknown error'}`,
  }))
}

function fmtBytes(n: number): string {
  if (n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
function fmtSpeed(bps: number): string {
  if (bps <= 0) return ''
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 ** 2) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
}
function fmtEta(secs: number): string {
  if (secs <= 0) return ''
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function QueueItem({ item }: { item: TransferItem }) {
  const { removeItem } = useTransferStore()
  const isActive = item.status === 'active'
  const isDone = item.status === 'done'
  const isFailed = item.status === 'failed'
  const tone = isFailed ? 'danger' : isDone ? 'success' : 'accent'
  const DirIcon = item.direction === 'upload' ? ArrowUp : ArrowDown

  const byteLabel = item.bytesTotal > 0
    ? `${fmtBytes(item.bytesDone)} / ${fmtBytes(item.bytesTotal)}`
    : item.bytesDone > 0 ? fmtBytes(item.bytesDone) : ''
  const speed = isActive ? fmtSpeed(item.speedBps) : ''
  const eta = isActive && item.etaSecs > 0 ? fmtEta(item.etaSecs) : ''

  return (
    <div className="flex flex-col gap-1.5 border-b border-border-hairline px-3.5 py-2">
      <div className="flex items-center gap-1.5">
        <DirIcon size={13} className={cn('shrink-0', isFailed ? 'text-danger' : isDone ? 'text-text-tertiary' : 'text-accent')} />
        <span className="flex-1 truncate text-[12px] text-text-primary">{item.filename}</span>
        {isFailed && (
          <>
            <button onClick={() => askAIAboutTransfer(item)} className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-info hover:bg-info/10 cursor-pointer">
              <Sparkles size={10} /> ask AI
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('ferry:retry-transfer', { detail: item.id }))} className="flex shrink-0 items-center gap-1 rounded-sm border border-accent px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10 cursor-pointer">
              <RotateCw size={10} /> retry
            </button>
          </>
        )}
        {(isDone || isFailed) && (
          <button onClick={() => removeItem(item.id)} aria-label="Remove" className="shrink-0 text-text-tertiary hover:text-text-primary cursor-pointer"><X size={13} /></button>
        )}
      </div>

      <Progress value={Math.min(100, item.progress)} tone={tone} />

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-text-tertiary">
        {isFailed ? (
          <span className="text-danger">{item.error ?? 'failed'}</span>
        ) : (
          <>
            {byteLabel && <span>{byteLabel}</span>}
            {speed && <><span>·</span><span className="text-accent">{speed}</span></>}
            {eta && <><span>·</span><span>ETA {eta}</span></>}
            {isDone && <span>done</span>}
          </>
        )}
      </div>
    </div>
  )
}

type TabKey = 'all' | 'active' | 'done' | 'failed'

export function TransferQueue() {
  const { queue, panelOpen, togglePanel, clearDone, clearAll } = useTransferStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 520), y: Math.max(0, window.innerHeight - 520) })
  const dragging = useRef(false)
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragging.current = true
    origin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 500, origin.current.px + ev.clientX - origin.current.mx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, origin.current.py + ev.clientY - origin.current.my)),
      })
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  const counts: Record<TransferStatus, number> = { active: 0, pending: 0, done: 0, failed: 0 }
  queue.forEach((t) => counts[t.status]++)
  const activeCount = counts.active + counts.pending
  const statusOrder: Record<TransferStatus, number> = { active: 0, pending: 1, failed: 2, done: 3 }

  const filtered = queue
    .filter((t) => {
      if (tab === 'active') return t.status === 'active' || t.status === 'pending'
      if (tab === 'done') return t.status === 'done'
      if (tab === 'failed') return t.status === 'failed'
      return true
    })
    .filter((t) => !search || t.filename.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  // Minimized: a small badge when transfers are running.
  if (!panelOpen) {
    if (activeCount === 0) return null
    return (
      <div
        onClick={togglePanel}
        className="fixed bottom-14 right-4 z-50 flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-border-strong bg-bg-elevated px-3.5 py-1.5 text-[11px] text-accent shadow-overlay"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        {activeCount} transfer{activeCount !== 1 ? 's' : ''} in progress
      </div>
    )
  }

  return (
    <div
      className="fixed z-50 flex h-[440px] w-[500px] flex-col overflow-hidden rounded-md border border-border-strong bg-bg-overlay shadow-overlay"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* title bar — drag handle */}
      <div
        onMouseDown={onTitleMouseDown}
        className="flex shrink-0 cursor-move select-none items-center gap-2 border-b border-border-hairline bg-bg-elevated px-3 py-2"
      >
        <span className="flex-1 text-[12px] font-semibold text-text-primary">
          Transfers
          {activeCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-accent">{activeCount} active</span>}
        </span>
        {counts.done > 0 && (
          <button onClick={clearDone} className="px-1 text-[10px] text-text-tertiary hover:text-text-primary cursor-pointer">clear done</button>
        )}
        {queue.length > 0 && activeCount === 0 && (
          <button onClick={clearAll} className="px-1 text-[10px] text-danger hover:opacity-80 cursor-pointer">clear all</button>
        )}
        <button onClick={togglePanel} aria-label="Minimize" className="text-text-tertiary hover:text-text-primary cursor-pointer"><Minus size={15} /></button>
      </div>

      {/* search + tabs */}
      <div className="shrink-0 border-b border-border-hairline bg-bg-elevated px-3 pt-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search transfers" className="mb-1.5 h-7 text-[11px]" />
        <TabList className="border-b-0">
          <Tab selected={tab === 'all'} onSelect={() => setTab('all')}>All{queue.length ? ` (${queue.length})` : ''}</Tab>
          <Tab selected={tab === 'active'} onSelect={() => setTab('active')}>Active{activeCount ? ` (${activeCount})` : ''}</Tab>
          <Tab selected={tab === 'done'} onSelect={() => setTab('done')}>Done{counts.done ? ` (${counts.done})` : ''}</Tab>
          <Tab selected={tab === 'failed'} onSelect={() => setTab('failed')}>Failed{counts.failed ? ` (${counts.failed})` : ''}</Tab>
        </TabList>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-text-tertiary">{search ? 'No matches.' : 'No transfers.'}</div>
        ) : (
          filtered.map((item) => <QueueItem key={item.id} item={item} />)
        )}
      </div>

      {/* footer summary */}
      {queue.length > 0 && (
        <div className="flex shrink-0 gap-3 border-t border-border-hairline bg-bg-elevated px-3.5 py-1.5 text-[10px] text-text-tertiary">
          <span>{queue.length} item{queue.length !== 1 ? 's' : ''}</span>
          {activeCount > 0 && <span className="text-accent">{activeCount} active</span>}
          {counts.done > 0 && <span>{counts.done} done</span>}
          {counts.failed > 0 && <span className="text-danger">{counts.failed} failed</span>}
        </div>
      )}
    </div>
  )
}

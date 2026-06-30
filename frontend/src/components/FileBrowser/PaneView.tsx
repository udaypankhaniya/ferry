import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft, ArrowRight, ArrowUp, RefreshCw, FolderPlus, Search, X, ChevronUp, ChevronDown, ChevronRight, Check,
  HardDrive, Cloud, Eye, EyeOff,
} from 'lucide-react'
import { FileRow } from './FileRow'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconButton, Input, Button, Skeleton } from '../ui'
import { cn } from '../../lib/cn'
import type { FileEntry } from '../../types'

interface ContextMenuState {
  x: number
  y: number
  entry: FileEntry
}

type SortKey = 'name' | 'size' | 'modified' | 'perms'
type SortDir = 'asc' | 'desc'

interface Props {
  label: 'local' | 'remote'
  path: string
  entries: FileEntry[]
  loading: boolean
  selected: Set<string>
  onNavigate: (path: string) => void
  onToggleSelect: (name: string) => void
  onDoubleClick: (entry: FileEntry) => void
  onDelete: (entry: FileEntry) => void
  onRename: (entry: FileEntry, newName: string) => void
  onMkdir: (name: string) => void
  onTransfer: (entry: FileEntry) => void // upload (local pane) or download (remote pane)
  onRefresh: () => void
}

// parentOf returns the parent directory, handling Windows drive roots
// ("C:/Users" → "C:/", "C:/" → "/" drives) and POSIX paths.
function parentOf(p: string): string {
  if (!p || p === '/') return '/'
  const win = /^[A-Za-z]:\//.test(p)
  const trimmed = p.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  const parent = trimmed.slice(0, idx)
  if (win && /^[A-Za-z]:$/.test(parent)) return parent + '/'
  return parent || '/'
}

export function PaneView({
  label, path, entries, loading, selected,
  onNavigate, onToggleSelect, onDoubleClick, onDelete, onRename, onMkdir, onTransfer, onRefresh,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<FileEntry | null>(null)
  const [renaming, setRenaming] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [mkdirActive, setMkdirActive] = useState(false)
  const [mkdirValue, setMkdirValue] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [activeIndex, setActiveIndex] = useState(0)

  // ── per-pane navigation history (Back / Forward) ──
  const [hist, setHist] = useState<{ stack: string[]; idx: number }>({ stack: [path], idx: 0 })
  useEffect(() => {
    // Sync history when path changes from anywhere. Back/Forward set the stack
    // first so the current entry already matches → no duplicate push.
    setHist((h) => {
      if (h.stack[h.idx] === path) return h
      const stack = h.stack.slice(0, h.idx + 1)
      stack.push(path)
      return { stack, idx: stack.length - 1 }
    })
    setQuery('') // filter is per-directory
    setActiveIndex(0)
  }, [path])

  const canBack = hist.idx > 0
  const canForward = hist.idx < hist.stack.length - 1
  function goBack() {
    if (!canBack) return
    const t = hist.stack[hist.idx - 1]
    setHist((h) => ({ ...h, idx: h.idx - 1 }))
    onNavigate(t)
  }
  function goForward() {
    if (!canForward) return
    const t = hist.stack[hist.idx + 1]
    setHist((h) => ({ ...h, idx: h.idx + 1 }))
    onNavigate(t)
  }

  // ── filter + sort ──
  const visible = useMemo(() => {
    let list = showHidden ? entries : entries.filter((e) => !e.isHidden)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1 // folders always first
      let cmp = 0
      switch (sort.key) {
        case 'size': cmp = a.size - b.size; break
        case 'modified': cmp = a.modified.localeCompare(b.modified); break
        case 'perms': cmp = a.permissions.localeCompare(b.permissions); break
        default: cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
      }
      return cmp * dir
    })
  }, [entries, showHidden, query, sort])

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  function startRename(entry: FileEntry) {
    setCtxMenu(null); setRenaming(entry); setRenameValue(entry.name); setMkdirActive(false)
  }
  function commitRename() {
    if (renaming && renameValue.trim() && renameValue.trim() !== renaming.name) onRename(renaming, renameValue.trim())
    setRenaming(null); setRenameValue('')
  }
  function startMkdir() {
    setCtxMenu(null); setMkdirActive(true); setMkdirValue('new folder'); setRenaming(null)
  }
  function commitMkdir() {
    if (mkdirValue.trim()) onMkdir(mkdirValue.trim())
    setMkdirActive(false); setMkdirValue('')
  }
  function cancelPrompt() {
    setRenaming(null); setMkdirActive(false); setRenameValue(''); setMkdirValue('')
  }
  function copyPath(entry: FileEntry) {
    navigator.clipboard.writeText(entry.path).catch(console.error); setCtxMenu(null)
  }
  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const breadcrumbs = path ? path.split('/').filter(Boolean) : []
  const promptActive = renaming !== null || mkdirActive
  const isWinPath = breadcrumbs.length > 0 && /^[A-Za-z]:$/.test(breadcrumbs[0])

  function breadcrumbPath(upTo: number): string {
    const parts = breadcrumbs.slice(0, upTo + 1)
    if (isWinPath) return parts.length === 1 ? parts[0] + '/' : parts.join('/')
    return '/' + parts.join('/')
  }

  // Middle-truncate: keep first + last segment, collapse the interior to "…".
  const MAX_VISIBLE_CRUMBS = 3
  const crumbItems: { seg: string; i: number; ellipsis?: boolean }[] =
    breadcrumbs.length > MAX_VISIBLE_CRUMBS
      ? [
          { seg: breadcrumbs[0], i: 0 },
          { seg: '…', i: -1, ellipsis: true },
          { seg: breadcrumbs[breadcrumbs.length - 1], i: breadcrumbs.length - 1 },
        ]
      : breadcrumbs.map((seg, i) => ({ seg, i }))

  // Keyboard nav when the pane has focus: Alt+←/→ history, ↑/↓ move cursor,
  // Enter open dir / select file, Space select, Backspace up a directory.
  function onKeyDown(e: React.KeyboardEvent) {
    const last = visible.length - 1
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack() }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(last, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') {
      const en = visible[activeIndex]
      if (en) { if (en.isDir) onDoubleClick(en); else onToggleSelect(en.name) }
    } else if (e.key === ' ') {
      e.preventDefault()
      const en = visible[activeIndex]
      if (en) onToggleSelect(en.name)
    } else if (e.key === 'Backspace') {
      e.preventDefault(); onNavigate(parentOf(path))
    }
  }

  // Keep the keyboard cursor in view.
  useEffect(() => {
    if (visible.length > 0) virtualizer.scrollToIndex(Math.min(activeIndex, visible.length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const SortCaret = ({ k }: { k: SortKey }) =>
    sort.key === k ? (
      sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
    ) : null

  const colHeader = (k: SortKey, labelText: string, extra: string) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        'flex items-center gap-0.5 text-[10px] uppercase tracking-wide cursor-pointer',
        sort.key === k ? 'text-text-secondary' : 'text-text-tertiary hover:text-text-secondary',
        extra
      )}
    >
      {labelText}
      <SortCaret k={k} />
    </button>
  )

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-base outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {/* pane header — identity + grouped nav */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-hairline px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {label === 'local'
            ? <HardDrive size={14} className="shrink-0 text-text-secondary" />
            : <Cloud size={14} className="shrink-0 text-text-secondary" />}
          <span className="text-[13px] font-semibold capitalize tracking-tight text-text-primary">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-md border border-border-hairline bg-bg-elevated p-0.5">
            <IconButton label="Back" size="sm" disabled={!canBack} onClick={goBack}><ArrowLeft size={14} /></IconButton>
            <IconButton label="Forward" size="sm" disabled={!canForward} onClick={goForward}><ArrowRight size={14} /></IconButton>
            <IconButton label="Up" size="sm" onClick={() => onNavigate(parentOf(path))}><ArrowUp size={14} /></IconButton>
            <span className="mx-0.5 h-4 w-px bg-border-strong" />
            <IconButton label="Refresh" size="sm" onClick={onRefresh}><RefreshCw size={13} /></IconButton>
          </div>
          <IconButton label="New folder" size="sm" onClick={startMkdir}><FolderPlus size={14} /></IconButton>
        </div>
      </div>

      {/* breadcrumb + filter */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-hairline bg-bg-inset/40 px-3 py-1.5">
        {/* breadcrumb — middle-truncated, mono */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden font-mono">
          <button className="shrink-0 text-[12px] text-text-secondary hover:text-text-primary" onClick={() => onNavigate('/')} title="Root / drives">
            {isWinPath ? 'drives' : '/'}
          </button>
          {crumbItems.map((item, idx) => (
            <span
              key={idx}
              className={cn('flex items-center gap-1', item.i === breadcrumbs.length - 1 ? 'min-w-0' : 'shrink-0')}
            >
              <ChevronRight size={12} className="shrink-0 text-text-tertiary" />
              {item.ellipsis ? (
                <span className="shrink-0 text-[12px] text-text-tertiary" title={breadcrumbs.join('/')}>…</span>
              ) : (
                <button
                  onClick={() => onNavigate(breadcrumbPath(item.i))}
                  title={item.seg}
                  className={cn(
                    'truncate text-[12px] hover:text-text-primary',
                    item.i === breadcrumbs.length - 1 ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {item.seg}
                </button>
              )}
            </span>
          ))}
        </div>

        {/* search + hidden toggle */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter"
              className="h-7 w-32 pl-7 pr-6 text-[12px]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear filter"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
            aria-pressed={showHidden}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer',
              showHidden
                ? 'border-accent/20 bg-accent/10 text-accent'
                : 'border-transparent text-text-tertiary hover:bg-bg-hover hover:text-text-secondary'
            )}
          >
            {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>

      {/* inline rename / mkdir prompt */}
      {promptActive && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-hairline bg-bg-elevated px-3 py-1.5">
          <span className="shrink-0 text-[11px] text-text-tertiary">{renaming ? `Rename "${renaming.name}":` : 'New folder:'}</span>
          <Input
            autoFocus
            className="h-7 flex-1 font-mono text-[12px]"
            value={renaming ? renameValue : mkdirValue}
            onChange={(e) => (renaming ? setRenameValue(e.target.value) : setMkdirValue(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renaming ? commitRename() : commitMkdir()
              if (e.key === 'Escape') cancelPrompt()
            }}
            onFocus={(e) => e.target.select()}
          />
          <Button size="sm" variant="primary" onClick={() => (renaming ? commitRename() : commitMkdir())}><Check size={13} />OK</Button>
          <IconButton label="Cancel" size="sm" variant="solid" onClick={cancelPrompt}><X size={13} /></IconButton>
        </div>
      )}

      {/* column headers (click to sort) */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border-hairline px-3 py-1">
        <span className="w-3.5 shrink-0" />
        {colHeader('name', 'Name', 'flex-1')}
        {colHeader('size', 'Size', 'w-16 justify-end shrink-0')}
        {colHeader('modified', 'Modified', 'w-[100px] justify-end shrink-0')}
        {colHeader('perms', 'Perms', 'w-[72px] justify-end shrink-0')}
      </div>

      {/* virtualized rows */}
      <div ref={containerRef} className="flex-1 overflow-y-auto pb-2">
        {loading ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                <Skeleton className="h-3 flex-1" style={{ maxWidth: `${40 + ((i * 13) % 45)}%` }} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-6 text-center text-[12px] text-text-tertiary">
            {query ? 'No matches.' : label === 'remote' ? 'Connect a host to browse files.' : 'Empty directory.'}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vitem) => {
              const entry = visible[vitem.index]
              return (
                <div
                  key={vitem.key}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: vitem.size, transform: `translateY(${vitem.start}px)` }}
                >
                  <FileRow
                    entry={entry}
                    selected={selected.has(entry.name)}
                    active={vitem.index === activeIndex}
                    onSelect={() => { setActiveIndex(vitem.index); onToggleSelect(entry.name) }}
                    onDoubleClick={() => onDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* context menu (positioned — computed inline is the allowed exception) */}
      {ctxMenu && (
        <div
          className="fixed z-100 min-w-40 rounded-md border border-border-strong bg-bg-overlay py-1 shadow-overlay"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          {([
            { label: label === 'local' ? 'Upload →' : '← Download', action: () => { setCtxMenu(null); onTransfer(ctxMenu.entry) } },
            { label: 'Rename', action: () => startRename(ctxMenu.entry) },
            { label: 'Copy path', action: () => copyPath(ctxMenu.entry) },
            { label: 'New folder', action: startMkdir },
            null,
            { label: 'Delete', danger: true, action: () => { setCtxMenu(null); setDeleteConfirm(ctxMenu.entry) } },
          ] as Array<{ label: string; action: () => void; danger?: boolean } | null>).map((item, i) =>
            item === null ? (
              <div key={i} className="my-1 h-px bg-border-hairline" />
            ) : (
              <div
                key={i}
                onClick={item.action}
                className={cn(
                  'cursor-pointer px-3.5 py-1.5 text-[12px] hover:bg-accent/10',
                  item.danger ? 'text-danger' : 'text-text-primary'
                )}
              >
                {item.label}
              </div>
            )
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete file"
        message={`Delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteConfirm) onDelete(deleteConfirm); setDeleteConfirm(null) }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

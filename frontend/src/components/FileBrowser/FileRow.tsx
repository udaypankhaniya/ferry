import { Folder, FileArchive, FileTerminal, File } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { FileEntry } from '../../types'

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

const ARCHIVE = ['zip', 'tar', 'gz', 'bz2', 'xz', 'rar', '7z']
const EXEC = ['sh', 'bash', 'exe', 'bin', 'run']

// Icon + tint per file type (filetype map from design.md).
function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.isDir) return <Folder size={14} className="text-info" />
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  if (ARCHIVE.includes(ext)) return <FileArchive size={14} className="text-cloud-caution" />
  if (EXEC.includes(ext)) return <FileTerminal size={14} className="text-local-safe" />
  return <File size={14} className="text-text-secondary" />
}

interface Props {
  entry: FileEntry
  selected: boolean
  active?: boolean
  onDoubleClick: () => void
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export function FileRow({ entry, selected, active, onDoubleClick, onSelect, onContextMenu }: Props) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'flex h-7 select-none items-center gap-2 px-3',
        selected ? 'bg-selection/40' : 'hover:bg-bg-elevated/60',
        active && 'ring-1 ring-inset ring-accent'
      )}
    >
      <span className="flex w-3.5 shrink-0 items-center justify-center"><FileIcon entry={entry} /></span>

      <span
        className={cn(
          'flex-1 truncate text-[13px]',
          entry.isHidden ? 'text-text-tertiary' : 'text-text-primary',
          !entry.isDir && 'font-mono'
        )}
      >
        {entry.name}
      </span>

      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-text-tertiary">
        {entry.isDir ? '' : fmtSize(entry.size)}
      </span>
      <span className="w-[100px] shrink-0 text-right text-[11px] text-text-tertiary">
        {entry.modified ? entry.modified.slice(0, 10) : ''}
      </span>
      <span className="w-[72px] shrink-0 text-right font-mono text-[11px] text-text-tertiary">
        {entry.permissions}
      </span>
    </div>
  )
}

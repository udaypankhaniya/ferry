import { cn } from '../../lib/cn'

// Lightweight tab building blocks (hand-built — Radix tabs not needed). Caller
// owns selection state. Used for terminal session tabs etc. Full arrow-key
// roving nav lands in Phase 3 (focus model).
export function TabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="tablist" className={cn('flex items-center gap-1 border-b border-border-hairline', className)}>
      {children}
    </div>
  )
}

export function Tab({
  selected,
  onSelect,
  children,
  className,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-t-sm px-3 py-1.5 text-[12px] cursor-pointer',
        'border-b-2 -mb-px transition-colors duration-[120ms]',
        selected
          ? 'border-accent text-text-primary bg-bg-elevated'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50',
        className
      )}
    >
      {children}
    </button>
  )
}

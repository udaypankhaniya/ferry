import * as RContext from '@radix-ui/react-context-menu'
import { cn } from '../../lib/cn'

// Right-click context menu reskinned to Ferry tokens. Same look as Menu; used
// by file rows / panes.
export const ContextMenu = RContext.Root
export const ContextMenuTrigger = RContext.Trigger

export function ContextMenuContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <RContext.Portal>
      <RContext.Content
        className={cn(
          'z-[20] min-w-[160px] rounded-md border border-border-strong bg-bg-overlay',
          'p-1 shadow-overlay outline-none',
          className
        )}
      >
        {children}
      </RContext.Content>
    </RContext.Portal>
  )
}

export function ContextMenuItem({
  children,
  onSelect,
  danger,
  className,
}: {
  children: React.ReactNode
  onSelect?: (e: Event) => void
  danger?: boolean
  className?: string
}) {
  return (
    <RContext.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none',
        'data-[highlighted]:bg-accent/10',
        danger ? 'text-danger' : 'text-text-primary',
        className
      )}
    >
      {children}
    </RContext.Item>
  )
}

export function ContextMenuSeparator() {
  return <RContext.Separator className="my-1 h-px bg-border-hairline" />
}

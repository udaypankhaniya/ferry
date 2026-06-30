import * as RMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/cn'

// Dropdown menu (click-triggered) reskinned to Ferry tokens. Radix handles
// keyboard nav, typeahead, focus, Escape, collision.
export const Menu = RMenu.Root
export const MenuTrigger = RMenu.Trigger

export function MenuContent({
  children,
  align = 'start',
  className,
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  return (
    <RMenu.Portal>
      <RMenu.Content
        align={align}
        sideOffset={4}
        className={cn(
          'z-[20] min-w-[160px] rounded-md border border-border-strong bg-bg-overlay',
          'p-1 shadow-overlay outline-none',
          className
        )}
      >
        {children}
      </RMenu.Content>
    </RMenu.Portal>
  )
}

export function MenuItem({
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
    <RMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[12px] outline-none',
        'data-[highlighted]:bg-accent/10',
        danger ? 'text-danger' : 'text-text-primary',
        className
      )}
    >
      {children}
    </RMenu.Item>
  )
}

export function MenuSeparator() {
  return <RMenu.Separator className="my-1 h-px bg-border-hairline" />
}

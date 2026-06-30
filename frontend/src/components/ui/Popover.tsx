import * as RPopover from '@radix-ui/react-popover'
import { cn } from '../../lib/cn'

// Radix popover reskinned to Ferry tokens. For richer floating content than a
// menu (forms, pickers). Radix handles focus, Escape, outside-click, collision.
export const Popover = RPopover.Root
export const PopoverTrigger = RPopover.Trigger
export const PopoverClose = RPopover.Close

export function PopoverContent({
  children,
  align = 'start',
  side = 'bottom',
  className,
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        align={align}
        side={side}
        sideOffset={6}
        className={cn(
          'z-[30] rounded-md border border-border-strong bg-bg-overlay p-3 shadow-overlay outline-none',
          className
        )}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  )
}

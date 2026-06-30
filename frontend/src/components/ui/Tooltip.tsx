import * as RTooltip from '@radix-ui/react-tooltip'
import { cn } from '../../lib/cn'

// Radix tooltip reskinned to Ferry tokens. Radix handles ARIA, focus, hover/
// focus open, escape, collision. Wrap the app (or a region) once in
// <TooltipProvider> for shared open/close timing.
export const TooltipProvider = RTooltip.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[30] select-none rounded-sm border border-border-strong bg-bg-elevated',
            'px-2 py-1 text-[11px] text-text-primary shadow-overlay',
            className
          )}
        >
          {content}
          <RTooltip.Arrow className="fill-[var(--color-bg-elevated)]" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

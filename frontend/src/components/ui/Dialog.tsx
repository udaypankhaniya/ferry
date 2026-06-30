import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

// Radix dialog reskinned to Ferry tokens. Radix gives focus-trap, scroll-lock,
// Escape, aria-modal, and overlay click-to-close for free.
export const Dialog = RDialog.Root
export const DialogTrigger = RDialog.Trigger
export const DialogClose = RDialog.Close

export function DialogContent({
  children,
  title,
  description,
  className,
  showClose = true,
}: {
  children: React.ReactNode
  title: string
  description?: string
  className?: string
  showClose?: boolean
}) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <RDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2',
          'rounded-md border border-border-strong bg-bg-overlay shadow-overlay',
          'flex flex-col gap-3 p-4 outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <RDialog.Title className="text-[14px] font-semibold text-text-primary">{title}</RDialog.Title>
            {description && (
              <RDialog.Description className="text-[12px] text-text-secondary">{description}</RDialog.Description>
            )}
          </div>
          {showClose && (
            <RDialog.Close asChild>
              <IconButton label="Close" size="sm"><X size={15} /></IconButton>
            </RDialog.Close>
          )}
        </div>
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  )
}

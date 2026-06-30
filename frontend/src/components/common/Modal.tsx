import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, width = 480, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-in flex max-h-[calc(100vh-80px)] flex-col rounded-md border border-border-strong bg-bg-overlay shadow-overlay"
        style={{ width }}
      >
        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border-hairline px-4 py-3">
          <span id="modal-title" className="flex-1 text-[14px] font-semibold text-text-primary">
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* footer */}
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border-hairline px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

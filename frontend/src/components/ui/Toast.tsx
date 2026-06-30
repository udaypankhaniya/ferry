import { useEffect } from 'react'
import { create } from 'zustand'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

// Minimal toast system (zustand — already a dep; no toast library). Imperative
// `toast(...)` from anywhere; render <Toaster/> once near the app root.
export type ToastTone = 'neutral' | 'success' | 'info' | 'danger'
interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastStore {
  items: ToastItem[]
  push: (message: string, tone: ToastTone) => void
  dismiss: (id: string) => void
}

const useToasts = create<ToastStore>((set) => ({
  items: [],
  push: (message, tone) =>
    set((s) => ({ items: [...s.items, { id: crypto.randomUUID(), message, tone }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

export const toast = (message: string, tone: ToastTone = 'neutral') =>
  useToasts.getState().push(message, tone)

const toneBorder: Record<ToastTone, string> = {
  neutral: 'border-l-border-strong',
  success: 'border-l-local-safe',
  info: 'border-l-info',
  danger: 'border-l-danger',
}

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss)
  // Auto-dismiss; cleared if the row unmounts first.
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), 4000)
    return () => clearTimeout(t)
  }, [item.id, dismiss])
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-sm border border-border-hairline border-l-2 bg-bg-elevated',
        'px-3 py-2 text-[12px] text-text-primary shadow-overlay',
        toneBorder[item.tone]
      )}
    >
      <span className="flex-1">{item.message}</span>
      <IconButton label="Dismiss" size="sm" onClick={() => dismiss(item.id)}><X size={13} /></IconButton>
    </div>
  )
}

export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastRow item={item} />
        </div>
      ))}
    </div>
  )
}

import { create } from 'zustand'
import type { TransferItem } from '../types'

interface TransferStore {
  queue: TransferItem[]
  panelOpen: boolean
  addItem: (item: TransferItem) => void
  updateItem: (id: string, patch: Partial<TransferItem>) => void
  removeItem: (id: string) => void
  clearDone: () => void
  clearAll: () => void
  togglePanel: () => void
}

export const useTransferStore = create<TransferStore>()((set) => ({
  queue: [],
  panelOpen: false,

  addItem: (item) => set((s) => ({ queue: [...s.queue, item] })),
  updateItem: (id, patch) =>
    set((s) => ({ queue: s.queue.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeItem: (id) => set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
  clearDone: () => set((s) => ({ queue: s.queue.filter((t) => t.status !== 'done') })),
  clearAll: () => set({ queue: [] }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}))

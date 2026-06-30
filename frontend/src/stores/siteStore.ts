import { create } from 'zustand'
import type { Site, ConnectionState, FileEntry } from '../types'

interface PaneState {
  path: string
  entries: FileEntry[]
  loading: boolean
  selected: Set<string>
}

const defaultPane = (): PaneState => ({
  path: '/',
  entries: [],
  loading: false,
  selected: new Set(),
})

interface SiteStore {
  sites: Site[]
  activeSite: Site | null
  connectionState: ConnectionState
  errorMessage: string
  localPane: PaneState
  remotePane: PaneState

  setSites: (sites: Site[]) => void
  setActiveSite: (site: Site | null) => void
  setConnectionState: (state: ConnectionState, error?: string) => void
  setLocalPane: (patch: Partial<PaneState>) => void
  setRemotePane: (patch: Partial<PaneState>) => void
  toggleLocalSelected: (name: string) => void
  toggleRemoteSelected: (name: string) => void
}

export const useSiteStore = create<SiteStore>()((set) => ({
  sites: [],
  activeSite: null,
  connectionState: 'idle',
  errorMessage: '',
  localPane: defaultPane(),
  remotePane: defaultPane(),

  setSites: (sites) => set({ sites }),
  setActiveSite: (site) => set({ activeSite: site, connectionState: 'idle', errorMessage: '' }),
  setConnectionState: (state, error = '') => set({ connectionState: state, errorMessage: error }),

  setLocalPane: (patch) =>
    set((s) => ({ localPane: { ...s.localPane, ...patch } })),
  setRemotePane: (patch) =>
    set((s) => ({ remotePane: { ...s.remotePane, ...patch } })),

  toggleLocalSelected: (name) =>
    set((s) => {
      const sel = new Set(s.localPane.selected)
      sel.has(name) ? sel.delete(name) : sel.add(name)
      return { localPane: { ...s.localPane, selected: sel } }
    }),
  toggleRemoteSelected: (name) =>
    set((s) => {
      const sel = new Set(s.remotePane.selected)
      sel.has(name) ? sel.delete(name) : sel.add(name)
      return { remotePane: { ...s.remotePane, selected: sel } }
    }),
}))

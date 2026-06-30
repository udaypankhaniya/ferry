import { create } from 'zustand'

export type ThemePref = 'system' | 'light' | 'dark'
export type FocusRegion = 'sites' | 'files' | 'terminal' | 'ai'

const THEME_KEY = 'ferry:theme'
const loadTheme = (): ThemePref => {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark'
}

interface AppStore {
  siteRailWidth: number
  siteRailCollapsed: boolean
  aiPanelWidth: number
  aiPanelCollapsed: boolean
  centerSplitRatio: number // 0–1: fraction for file browser height
  theme: ThemePref
  focusedRegion: FocusRegion
  setFocusedRegion: (r: FocusRegion) => void
  setSiteRailWidth: (w: number) => void
  setSiteRailCollapsed: (v: boolean) => void
  setAIPanelWidth: (w: number) => void
  setAIPanelCollapsed: (v: boolean) => void
  setCenterSplitRatio: (r: number) => void
  setTheme: (t: ThemePref) => void
  toggleSiteRail: () => void
  toggleAIPanel: () => void
}

export const useAppStore = create<AppStore>()((set) => ({
  siteRailWidth: 220,
  siteRailCollapsed: false,
  aiPanelWidth: 320,
  aiPanelCollapsed: false,
  centerSplitRatio: 0.55,
  theme: loadTheme(),
  focusedRegion: 'files',
  setFocusedRegion: (r) => set({ focusedRegion: r }),
  setSiteRailWidth: (w) => set({ siteRailWidth: Math.max(150, Math.min(400, w)) }),
  setSiteRailCollapsed: (v) => set({ siteRailCollapsed: v }),
  setAIPanelWidth: (w) => set({ aiPanelWidth: Math.max(200, Math.min(520, w)) }),
  setAIPanelCollapsed: (v) => set({ aiPanelCollapsed: v }),
  setCenterSplitRatio: (r) => set({ centerSplitRatio: Math.max(0.2, Math.min(0.85, r)) }),
  setTheme: (t) => { localStorage.setItem(THEME_KEY, t); set({ theme: t }) },
  toggleSiteRail: () => set((s) => ({ siteRailCollapsed: !s.siteRailCollapsed })),
  toggleAIPanel: () => set((s) => ({ aiPanelCollapsed: !s.aiPanelCollapsed })),
}))

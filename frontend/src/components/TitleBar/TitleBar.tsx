import { Menu, Sparkles, Sun, Moon } from 'lucide-react'
import { useAIStore } from '../../stores/aiStore'
import { useSiteStore } from '../../stores/siteStore'
import { useAppStore } from '../../stores/appStore'
import { IconButton, TrustBadge } from '../ui'

function FerryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 10h12l-1.5-4H3.5L2 10z" fill="currentColor" opacity="0.9" />
      <path d="M1 10h14l-0.5 1.5a1 1 0 0 1-.95.5H2.45a1 1 0 0 1-.95-.5L1 10z" fill="currentColor" />
      <rect x="6" y="5" width="1.2" height="4" rx="0.4" fill="currentColor" opacity="0.7" />
      <rect x="8.8" y="4" width="1.2" height="5" rx="0.4" fill="currentColor" opacity="0.7" />
      <path d="M6 5 C6 5 7 3.5 8 3.5 C9 3.5 10 4 10 4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  )
}

export function TitleBar() {
  const { activeSite } = useSiteStore()
  const { provider } = useAIStore()
  const { toggleSiteRail, toggleAIPanel, theme, setTheme } = useAppStore()

  const resolvedDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="drag-region relative flex h-9 shrink-0 select-none items-center justify-between px-1">
      {/* left — decorative traffic lights + rail toggle */}
      <div className="no-drag flex items-center gap-3 pl-1">
   
        <IconButton label="Toggle host rail (Ctrl+B)" size="sm" onClick={toggleSiteRail}>
          <Menu size={15} />
        </IconButton>
      </div>

      {/* center — brand + active host */}
      <div className="no-drag absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <span className="text-accent opacity-90"><FerryIcon size={14} /></span>
        <span className="text-[13px] font-semibold tracking-tight text-text-primary">Ferry</span>
        {activeSite && (
          <>
            <span className="font-mono text-[11px] text-text-tertiary">/</span>
            <span className="truncate max-w-45 rounded-full border border-border-hairline bg-bg-elevated px-2 py-0.5 text-[12px] font-medium text-text-secondary">
              {activeSite.name || activeSite.host}
            </span>
          </>
        )}
      </div>

      {/* right — theme toggle + trust badge + ask AI */}
      <div className="no-drag flex items-center gap-2 pr-1">
        <button
          onClick={() => setTheme(resolvedDark ? 'light' : 'dark')}
          title={resolvedDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
        >
          {resolvedDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <TrustBadge provider={provider} bordered />
        <button
          onClick={toggleAIPanel}
          title="Toggle AI panel (Ctrl+J)"
          className="flex h-7 items-center gap-1.5 rounded-lg border border-transparent bg-accent/5 px-2.5 text-accent hover:bg-accent/10 hover:border-accent/20 transition-all cursor-pointer"
        >
          <Sparkles size={13} />
          <span className="text-[12px] font-semibold">Ask AI</span>
        </button>
      </div>
    </div>
  )
}
